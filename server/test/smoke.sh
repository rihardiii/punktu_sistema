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

echo "== logout =="
api "$K_JAR" POST /api/auth/logout > /dev/null
check "session ended" "$(api "$K_JAR" GET /api/auth/me | j "['user']")" "None"

rm -f "$P_JAR" "$K_JAR"
echo
if [ "$FAILED" = 0 ]; then echo "ALL PASSED"; else echo "SOME TESTS FAILED"; fi
exit $FAILED
