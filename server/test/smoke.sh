#!/usr/bin/env bash
# End-to-end smoke test of the API: setup -> kid -> submission -> approval ->
# balance -> redemption -> approval -> final balance, plus the guard rails.
# Usage: BASE=http://localhost:4199 ./smoke.sh
set -uo pipefail

BASE="${BASE:-http://localhost:4199}"
P_JAR=$(mktemp) ; K_JAR=$(mktemp)
FAILED=0

# j  -> index into the JSON body, e.g.  j "['user']['id']"
j() { python -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$1" 2>/dev/null; }
# jx -> evaluate an expression over the body, e.g.  jx "len(d['users'])"
jx() { python -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then
    printf '  ok   %-42s %s\n' "$1" "$2"
  else
    printf '  FAIL %-42s got=%s want=%s\n' "$1" "$2" "$3"; FAILED=1
  fi
}

api() { # api <jar> <method> <path> [json]
  local jar=$1 method=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -b "$jar" -c "$jar" -X "$method" -H 'Content-Type: application/json' \
      -d "$body" "$BASE$path"
  else
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path"
  fi
}

echo "== setup =="
check "needs setup" "$(api "$P_JAR" GET /api/auth/setup/status | j "['needsSetup']")" "True"
check "create first parent" \
  "$(api "$P_JAR" POST /api/auth/setup '{"name":"Mamma","username":"mamma","pin":"1234"}' | j "['user']['role']")" \
  "parent"
check "setup is one-shot" \
  "$(api "$P_JAR" POST /api/auth/setup '{"name":"X","username":"x","pin":"1234"}' | j "['error']")" \
  "already_set_up"
check "starter deeds seeded" "$(api "$P_JAR" GET /api/catalog/deeds | jx "len(d['deeds'])>0" )" "True"

echo "== users =="
KID=$(api "$P_JAR" POST /api/users '{"name":"Anna","username":"anna","pin":"1111","role":"kid"}' | j "['user']['id']")
check "kid created" "$([ -n "$KID" ] && echo yes)" "yes"
check "duplicate username rejected" \
  "$(api "$P_JAR" POST /api/users '{"name":"Anna2","username":"anna","pin":"2222","role":"kid"}' | j "['error']")" \
  "username_taken"
check "kid cannot create users" \
  "$(api "$K_JAR" POST /api/users '{"name":"Z","username":"z","pin":"1234"}' | j "['error']")" \
  "unauthorized"

echo "== auth =="
check "wrong pin rejected" \
  "$(api "$K_JAR" POST /api/auth/login '{"username":"anna","pin":"9999"}' | j "['error']")" \
  "bad_credentials"
check "kid logs in" \
  "$(api "$K_JAR" POST /api/auth/login '{"username":"anna","pin":"1111"}' | j "['user']['name']")" \
  "Anna"

echo "== submissions =="
DEED=$(api "$P_JAR" GET /api/catalog/deeds | j "['deeds'][0]['id']")
PTS=$(api "$P_JAR" GET /api/catalog/deeds | j "['deeds'][0]['points']")
SUB=$(api "$K_JAR" POST /api/submissions "{\"deedId\":$DEED,\"note\":\"visi trauki\"}" | j "['submission']['id']")
check "kid submitted a deed" "$(api "$K_JAR" GET /api/submissions | j "['submissions'][0]['status']")" "pending"
check "balance still 0 while pending" "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['balance']")" "0"
check "pending points shown" "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['pending']")" "$PTS"
check "kid cannot approve own deed" \
  "$(api "$K_JAR" POST "/api/submissions/$SUB/review" '{"decision":"approve"}' | j "['error']")" \
  "parent_only"
check "parent approves" \
  "$(api "$P_JAR" POST "/api/submissions/$SUB/review" '{"decision":"approve"}' | j "['submission']['status']")" \
  "approved"
check "points credited" "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['balance']")" "$PTS"
check "double approval blocked" \
  "$(api "$P_JAR" POST "/api/submissions/$SUB/review" '{"decision":"approve"}' | j "['error']")" \
  "already_reviewed"
check "no double credit" "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['balance']")" "$PTS"

echo "== rejection does not credit =="
SUB2=$(api "$K_JAR" POST /api/submissions "{\"deedId\":$DEED}" | j "['submission']['id']")
api "$P_JAR" POST "/api/submissions/$SUB2/review" '{"decision":"reject","note":"nebija izdarits"}' > /dev/null
check "balance unchanged after reject" "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['balance']")" "$PTS"

echo "== redemptions =="
api "$P_JAR" POST /api/points/adjust "{\"kidId\":$KID,\"delta\":500,\"reason\":\"Sakuma bonuss\"}" > /dev/null
BAL=$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['balance']")
check "parent adjustment applied" "$BAL" "$((PTS + 500))"

RW=$(api "$K_JAR" GET /api/catalog/rewards | j "['rewards'][0]['id']")
COST=$(api "$K_JAR" GET /api/catalog/rewards | j "['rewards'][0]['cost']")
RED=$(api "$K_JAR" POST /api/redemptions "{\"rewardId\":$RW}" | j "['redemption']['id']")
check "points reserved, not spent" "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['balance']")" "$BAL"
check "available reduced by reserve" \
  "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['available']")" "$((BAL - COST))"
check "parent approves redemption" \
  "$(api "$P_JAR" POST "/api/redemptions/$RED/review" '{"decision":"approve"}' | j "['redemption']['status']")" \
  "approved"
check "points deducted" "$(api "$K_JAR" GET "/api/points/balance/$KID" | j "['balance']")" "$((BAL - COST))"

echo "== overspending blocked =="
EXP=$(api "$P_JAR" POST /api/catalog/rewards '{"title_lv":"Milzu balva","cost":999999}' | j "['reward']['id']")
check "cannot request unaffordable reward" \
  "$(api "$K_JAR" POST /api/redemptions "{\"rewardId\":$EXP}" | j "['error']")" \
  "insufficient_points"

echo "== catalog editing =="
ED=$(api "$P_JAR" POST /api/catalog/deeds '{"title_lv":"Slaucit putekljus","points":7}' | j "['deed']['id']")
check "editing a deed saves the new title" \
  "$(api "$P_JAR" PATCH "/api/catalog/deeds/$ED" '{"title_lv":"Slaucit gridu","points":9,"active":true}' | j "['deed']['title_lv']")" \
  "Slaucit gridu"
check "the new points stuck" \
  "$(api "$P_JAR" GET '/api/catalog/deeds?all=true' | jx "[x['points'] for x in d['deeds'] if x['id']==$ED][0]")" "9"
# The edit form sends back the 0/1 a row carries, not a JSON boolean. Rejecting
# that as an invalid value is what made every save fail in 0.10.
check "active accepts the 0/1 a row carries" \
  "$(api "$P_JAR" PATCH "/api/catalog/deeds/$ED" '{"title_lv":"Slaucit gridu","active":0}' | j "['deed']['active']")" "0"
check "and 1 switches it back on" \
  "$(api "$P_JAR" PATCH "/api/catalog/deeds/$ED" '{"title_lv":"Slaucit gridu","active":1}' | j "['deed']['active']")" "1"
check "nonsense in active is still a 400" \
  "$(api "$P_JAR" PATCH "/api/catalog/deeds/$ED" '{"active":"varbut"}' | j "['error']")" "invalid_field"

ER=$(api "$P_JAR" POST /api/catalog/rewards '{"title_lv":"Kino vakars","cost":120}' | j "['reward']['id']")
check "editing a reward saves the new cost" \
  "$(api "$P_JAR" PATCH "/api/catalog/rewards/$ER" '{"title_lv":"Kino vakars","cost":150,"active":1}' | j "['reward']['cost']")" \
  "150"
check "a kid cannot edit the catalog" \
  "$(api "$K_JAR" PATCH "/api/catalog/deeds/$ED" '{"points":9999}' | j "['error']")" "parent_only"
api "$P_JAR" DELETE "/api/catalog/deeds/$ED" > /dev/null
api "$P_JAR" DELETE "/api/catalog/rewards/$ER" > /dev/null

echo "== time windows =="
# Windows are wall-clock times, so the test has to build them around whatever
# hour it is run at: one slot spanning now, and one that certainly is not now.
# Both stay inside the day, so neither wraps past midnight.
eval "$(python - <<'PY'
from datetime import datetime
m = datetime.now().hour * 60 + datetime.now().minute
shut = (0, 60) if m >= 720 else (1380, 1439)
print(f"""OPEN_W='[{{"start_min":{max(0, m - 60)},"end_min":{min(1439, m + 60)}}}]'""")
print(f"""SHUT_W='[{{"start_min":{shut[0]},"end_min":{shut[1]}}}]'""")
PY
)"

WD=$(api "$P_JAR" POST /api/catalog/deeds \
  "{\"title_lv\":\"Tirit zobus\",\"points\":5,\"windows\":$SHUT_W}" | j "['deed']['id']")
check "a window is stored with the deed" \
  "$(api "$P_JAR" GET '/api/catalog/deeds?all=true' | jx "len([x for x in d['deeds'] if x['id']==$WD][0]['windows'])")" "1"
check "out of hours the tile is locked" \
  "$(api "$K_JAR" GET /api/catalog/deeds | jx "[x['locked'] for x in d['deeds'] if x['id']==$WD][0]")" "window"
# The lock is a server rule, not just a greyed-out button: a stale page or a
# second phone must not be able to file it anyway.
check "out of hours the server refuses it" \
  "$(api "$K_JAR" POST /api/submissions "{\"deedId\":$WD}" | j "['error']")" "outside_time_window"

api "$P_JAR" PATCH "/api/catalog/deeds/$WD" "{\"windows\":$OPEN_W}" > /dev/null
check "inside the window the tile is open" \
  "$(api "$K_JAR" GET /api/catalog/deeds | jx "[x['locked'] for x in d['deeds'] if x['id']==$WD][0]")" ""
check "inside the window it can be filed" \
  "$(api "$K_JAR" POST /api/submissions "{\"deedId\":$WD}" | j "['submission']['status']")" "pending"
# A patch that says nothing about windows is not a patch that clears them.
api "$P_JAR" PATCH "/api/catalog/deeds/$WD" '{"points":6}' > /dev/null
check "an unrelated edit keeps the windows" \
  "$(api "$P_JAR" GET '/api/catalog/deeds?all=true' | jx "len([x for x in d['deeds'] if x['id']==$WD][0]['windows'])")" "1"
check "and an empty list clears them" \
  "$(api "$P_JAR" PATCH "/api/catalog/deeds/$WD" '{"windows":[]}' | jx "len(d['deed']['windows'])")" "0"

check "a backwards window is refused" \
  "$(api "$P_JAR" POST /api/catalog/deeds '{"title_lv":"Slikts","points":5,"windows":[{"start_min":600,"end_min":540}]}' | j "['error']")" \
  "invalid_time_window"
check "overlapping windows are refused" \
  "$(api "$P_JAR" POST /api/catalog/deeds '{"title_lv":"Slikts","points":5,"windows":[{"start_min":420,"end_min":600},{"start_min":540,"end_min":700}]}' | j "['error']")" \
  "invalid_time_window"
check "five windows are too many" \
  "$(api "$P_JAR" POST /api/catalog/deeds '{"title_lv":"Slikts","points":5,"windows":[{"start_min":0,"end_min":10},{"start_min":20,"end_min":30},{"start_min":40,"end_min":50},{"start_min":60,"end_min":70},{"start_min":80,"end_min":90}]}' | j "['error']")" \
  "too_many_windows"

echo "== how many times a day =="
LD=$(api "$P_JAR" POST /api/catalog/deeds '{"title_lv":"Saklat gultu","points":5,"max_per_day":1}' | j "['deed']['id']")
LS=$(api "$K_JAR" POST /api/submissions "{\"deedId\":$LD}" | j "['submission']['id']")
check "the first one of the day goes through" "$([ -n "$LS" ] && echo yes)" "yes"
check "the second is refused" \
  "$(api "$K_JAR" POST /api/submissions "{\"deedId\":$LD}" | j "['error']")" "daily_limit_reached"
# Pending counts against the cap — otherwise the same deed could be filed ten
# times over before a parent had looked at the first one.
check "and the tile says so" \
  "$(api "$K_JAR" GET /api/catalog/deeds | jx "[x['locked'] for x in d['deeds'] if x['id']==$LD][0]")" "limit"
check "today's count is shown" \
  "$(api "$K_JAR" GET /api/catalog/deeds | jx "[x['done_today'] for x in d['deeds'] if x['id']==$LD][0]")" "1"

api "$P_JAR" POST "/api/submissions/$LS/review" '{"decision":"reject","note":"gulta nav saklata"}' > /dev/null
check "being turned down gives the slot back" \
  "$(api "$K_JAR" POST /api/submissions "{\"deedId\":$LD}" | j "['submission']['status']")" "pending"
check "but an approval does not" \
  "$(api "$K_JAR" POST /api/submissions "{\"deedId\":$LD}" | j "['error']")" "daily_limit_reached"

echo "== notifications =="
check "a parent is told what is waiting" \
  "$(api "$P_JAR" GET /api/notifications | jx "d['pendingSubmissions']>0")" "True"
check "a parent gets no answer events" \
  "$(api "$P_JAR" GET /api/notifications | jx "len(d['events'])")" "0"
check "a kid is told their deed was turned down" \
  "$(api "$K_JAR" GET /api/notifications | jx "len([e for e in d['events'] if e['status']=='rejected'])>0")" "True"
check "a kid is not shown the pending queue" \
  "$(api "$K_JAR" GET /api/notifications | jx "d['pendingSubmissions']")" "0"

echo "== privacy between siblings =="
KID2=$(api "$P_JAR" POST /api/users '{"name":"Bruno","username":"bruno","pin":"2222","role":"kid"}' | j "['user']['id']")
check "kid cannot read sibling balance" \
  "$(api "$K_JAR" GET "/api/points/balance/$KID2" | j "['error']")" "forbidden"
check "kid sees only self in user list" \
  "$(api "$K_JAR" GET /api/users | jx "len(d['users'])")" "1"
check "parent sees whole family" \
  "$(api "$P_JAR" GET /api/users | jx "len(d['users'])")" "3"

echo "== last parent protection =="
MEID=$(api "$P_JAR" GET /api/auth/me | j "['user']['id']")
check "cannot deactivate last parent" \
  "$(api "$P_JAR" PATCH "/api/users/$MEID" '{"active":false}' | j "['error']")" "last_parent"

echo "== admin role =="
check "the parent who ran setup is the admin" \
  "$(api "$P_JAR" GET /api/auth/me | j "['user']['is_admin']")" "True"

D_JAR=$(mktemp)
DAD=$(api "$P_JAR" POST /api/users '{"name":"Tetis","username":"tetis","pin":"4444","role":"parent"}' | j "['user']['id']")
api "$D_JAR" POST /api/auth/login '{"username":"tetis","pin":"4444"}' > /dev/null
check "a parent added later is not admin" \
  "$(api "$D_JAR" GET /api/auth/me | j "['user']['is_admin']")" "False"
check "plain parent cannot deactivate the admin" \
  "$(api "$D_JAR" PATCH "/api/users/$MEID" '{"active":false}' | j "['error']")" "admin_only"
check "admin cannot be deleted" \
  "$(api "$D_JAR" DELETE "/api/users/$MEID?purge=true" | j "['error']")" "admin_only"

echo "== forgotten PIN requests =="
api "$K_JAR" POST /api/auth/pin-request '{"username":"bruno"}' > /dev/null
api "$K_JAR" POST /api/auth/pin-request '{"username":"bruno"}' > /dev/null
check "tapping twice files one request" \
  "$(api "$D_JAR" GET /api/users/pin-requests | jx "len(d['requests'])")" "1"
check "an unknown username files nothing" \
  "$(api "$K_JAR" POST /api/auth/pin-request '{"username":"nobody"}' | j "['ok']")" "True"
check "still one request" \
  "$(api "$D_JAR" GET /api/users/pin-requests | jx "len(d['requests'])")" "1"

api "$K_JAR" POST /api/auth/pin-request '{"username":"tetis"}' > /dev/null
check "a plain parent sees only the kids' requests" \
  "$(api "$D_JAR" GET /api/users/pin-requests | jx "len(d['requests'])")" "1"
check "the admin also sees a parent's request" \
  "$(api "$P_JAR" GET /api/users/pin-requests | jx "len(d['requests'])")" "2"

check "a parent cannot reset another parent's PIN" \
  "$(api "$D_JAR" POST "/api/users/$MEID/reset-pin" '{"pin":"9876"}' | j "['error']")" "admin_only"
check "the admin can reset a parent's PIN" \
  "$(api "$P_JAR" POST "/api/users/$DAD/reset-pin" '{"pin":"4545"}' | j "['ok']")" "True"
check "the reset closed that request" \
  "$(api "$P_JAR" GET /api/users/pin-requests | jx "len(d['requests'])")" "1"
# The reset logged every device out, so the new PIN is the only way back in.
check "the new PIN works" \
  "$(api "$D_JAR" POST /api/auth/login '{"username":"tetis","pin":"4545"}' | j "['user']['name']")" "Tetis"

echo "== admin handover =="
check "the admin can hand the role over" \
  "$(api "$P_JAR" POST "/api/users/$DAD/make-admin" | j "['user']['is_admin']")" "True"
check "the previous admin lost it" \
  "$(api "$P_JAR" GET /api/auth/me | j "['user']['is_admin']")" "False"
check "a non-admin cannot grant it" \
  "$(api "$P_JAR" POST "/api/users/$MEID/make-admin" | j "['error']")" "admin_only"

echo "== wrong-PIN lockout =="
# A throwaway account, so locking it out cannot disturb anything above.
api "$D_JAR" POST /api/users '{"name":"Lote","username":"lote","pin":"3333","role":"kid"}' > /dev/null
L_JAR=$(mktemp)
for _ in 1 2 3 4; do
  api "$L_JAR" POST /api/auth/login '{"username":"lote","pin":"0000"}' > /dev/null
done
check "the 5th wrong PIN locks the account" \
  "$(api "$L_JAR" POST /api/auth/login '{"username":"lote","pin":"0000"}' | j "['error']")" \
  "too_many_attempts"
# The point of the lock: even the correct PIN is refused while it holds.
check "the correct PIN is refused while locked" \
  "$(api "$L_JAR" POST /api/auth/login '{"username":"lote","pin":"3333"}' | j "['error']")" \
  "too_many_attempts"
check "the lock is per account, not per device" \
  "$(api "$L_JAR" POST /api/auth/login '{"username":"anna","pin":"1111"}' | j "['user']['name']")" \
  "Anna"

echo "== malformed input =="
check "unparseable JSON is a 400, not a 500" \
  "$(curl -s -X POST -H 'Content-Type: application/json' -d '{bad' "$BASE/api/auth/login" | j "['error']")" \
  "invalid_json"

echo "== logout =="
api "$K_JAR" POST /api/auth/logout > /dev/null
check "session ended" "$(api "$K_JAR" GET /api/auth/me | j "['user']")" "None"

rm -f "$P_JAR" "$K_JAR" "$D_JAR" "$L_JAR"
echo
if [ "$FAILED" = 0 ]; then echo "ALL PASSED"; else echo "SOME TESTS FAILED"; fi
exit $FAILED
