#!/usr/bin/env bash
# Gera preview/server/legado-planos.json com quem tinha plano no Etnias 1.0 (Wo_Users.is_pro/pro_type/pro_time),
# lendo o banco recuperado local (container etnias-recovery-db-1) só com SELECT. Saída: só legacyId, tipo e data — sem
# nome, e-mail ou telefone. O arquivo não vai para o Git; segue para a VPS no rsync de preview/server.
set -euo pipefail
cd "$(dirname "$0")/.."
docker exec etnias-recovery-db-1 sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -N -B -e "SELECT user_id, pro_type, pro_time FROM Wo_Users WHERE is_pro='"'"'1'"'"' AND active='"'"'1'"'"' AND banned=0 ORDER BY user_id" 2>/dev/null' \
 | node -e '
let raw="";process.stdin.on("data",c=>raw+=c).on("end",()=>{
  const ids={1:"star",2:"hot",3:"ultima",4:"vip"};
  const list=raw.trim().split("\n").filter(Boolean).map(l=>{const [id,type,time]=l.split("\t");return {legacyId:Number(id),plan:ids[type]||null,since:Number(time)*1000};}).filter(r=>r.plan&&r.since>0);
  require("fs").writeFileSync("preview/server/legado-planos.json",JSON.stringify({geradoEm:new Date().toISOString(),origem:"Wo_Users.is_pro/pro_type/pro_time",assinantes:list},null,1)+"\n");
  console.log(list.length+" assinantes do Etnias 1.0 em preview/server/legado-planos.json");
});'
