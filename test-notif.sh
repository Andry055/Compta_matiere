#!/bin/bash
BASE="http://localhost:1337/api"

get_token() {
  curl -s -X POST "$BASE/auth/local" \
    -H "Content-Type: application/json" \
    -d "{\"identifier\":\"$1\",\"password\":\"$2\"}" 2>/dev/null | \
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).jwt||'')}catch(e){console.log('')}})"
}

echo "==> Obtention des jetons d'authentification (valeurs non affichees)..."
TOKEN_A=$(get_token "tolotra.randria@mtefop.gov.mg" "demandeur123")
TOKEN_B=$(get_token "hery.rakoto@mtefop.gov.mg" "depositaire123")

if [ -z "$TOKEN_A" ] || [ -z "$TOKEN_B" ]; then
  echo "ECHEC: impossible d'obtenir un jeton. Strapi est-il demarre ?"
  exit 1
fi
echo "   Jeton utilisateur A (demandeur): obtenu"
echo "   Jeton utilisateur B (depositaire): obtenu"

echo ""
echo "===== 1. SSE /api/sse/stream - JWT valide (utilisateur A) ====="
curl -s -D /tmp/sse_a_headers.txt -o /tmp/sse_a_body.txt --max-time 4 "$BASE/sse/stream?jwt=$TOKEN_A" || true
HTTP_A=$(grep -i "^HTTP/" /tmp/sse_a_headers.txt | tail -1 | awk '{print $2}')
echo "   Code HTTP: $HTTP_A"
echo "   Corps recu (evenements SSE):"
cat /tmp/sse_a_body.txt
echo ""

echo "===== 2. SSE /api/sse/stream - JWT absent ====="
curl -s -D /tmp/sse_nojwt_headers.txt -o /tmp/sse_nojwt_body.txt "$BASE/sse/stream" || true
HTTP_NOJWT=$(grep -i "^HTTP/" /tmp/sse_nojwt_headers.txt | tail -1 | awk '{print $2}')
echo "   Code HTTP: $HTTP_NOJWT"
cat /tmp/sse_nojwt_body.txt
echo ""

echo "===== 3. SSE /api/sse/stream - JWT invalide ====="
curl -s -D /tmp/sse_bad_headers.txt -o /tmp/sse_bad_body.txt --max-time 4 "$BASE/sse/stream?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token" || true
HTTP_BAD=$(grep -i "^HTTP/" /tmp/sse_bad_headers.txt | tail -1 | awk '{print $2}')
echo "   Code HTTP: $HTTP_BAD"
cat /tmp/sse_bad_body.txt
echo ""

echo "===== 4. Outbox /api/notification-outbox/notifications - JWT valide (utilisateur A) ====="
curl -s -D /tmp/ob_a_headers.txt -o /tmp/ob_a_body.txt -H "Authorization: Bearer $TOKEN_A" "$BASE/notification-outbox/notifications" || true
HTTP_OBA=$(grep -i "^HTTP/" /tmp/ob_a_headers.txt | tail -1 | awk '{print $2}')
echo "   Code HTTP: $HTTP_OBA"
cat /tmp/ob_a_body.txt
echo ""

echo "===== 5. Outbox - JWT absent ====="
curl -s -D /tmp/ob_nojwt_headers.txt -o /tmp/ob_nojwt_body.txt "$BASE/notification-outbox/notifications" || true
HTTP_OB_NOJWT=$(grep -i "^HTTP/" /tmp/ob_nojwt_headers.txt | tail -1 | awk '{print $2}')
echo "   Code HTTP: $HTTP_OB_NOJWT"
cat /tmp/ob_nojwt_body.txt
echo ""

echo "===== 6. Outbox - JWT invalide ====="
curl -s -D /tmp/ob_bad_headers.txt -o /tmp/ob_bad_body.txt -H "Authorization: Bearer invalide" "$BASE/notification-outbox/notifications" || true
HTTP_OB_BAD=$(grep -i "^HTTP/" /tmp/ob_bad_headers.txt | tail -1 | awk '{print $2}')
echo "   Code HTTP: $HTTP_OB_BAD"
cat /tmp/ob_bad_body.txt
echo ""

echo "===== 7. Outbox - utilisateur B (isolation) ====="
curl -s -D /tmp/ob_b_headers.txt -o /tmp/ob_b_body.txt -H "Authorization: Bearer $TOKEN_B" "$BASE/notification-outbox/notifications" || true
HTTP_OBB=$(grep -i "^HTTP/" /tmp/ob_b_headers.txt | tail -1 | awk '{print $2}')
echo "   Code HTTP: $HTTP_OBB"
cat /tmp/ob_b_body.txt
echo ""

echo "===== TESTS TERMINES ====="
