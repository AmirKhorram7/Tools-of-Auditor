#!/bin/sh
set -e

USER_NAME="${CLICKHOUSE_USER:-tauditor}"
PASSWORD="${CLICKHOUSE_PASSWORD:-}"

if [ -n "$PASSWORD" ]; then
  HASH="$(python -c "import hashlib,os; print(hashlib.sha256(os.environ['CLICKHOUSE_PASSWORD'].encode()).hexdigest())")"
  PASSWORD_XML="<password_sha256_hex>${HASH}</password_sha256_hex>"
else
  PASSWORD_XML="<password></password>"
fi

cat > /etc/clickhouse-server/users.xml <<EOF
<clickhouse>
  <profiles>
    <default>
      <max_memory_usage>10000000000</max_memory_usage>
      <use_uncompressed_cache>0</use_uncompressed_cache>
      <load_balancing>random</load_balancing>
    </default>
  </profiles>
  <quotas>
    <default>
      <interval>
        <duration>3600</duration>
        <queries>0</queries>
        <errors>0</errors>
        <result_rows>0</result_rows>
        <read_rows>0</read_rows>
        <execution_time>0</execution_time>
      </interval>
    </default>
  </quotas>
  <users>
    <${USER_NAME}>
      ${PASSWORD_XML}
      <networks>
        <ip>::/0</ip>
      </networks>
      <profile>default</profile>
      <quota>default</quota>
      <access_management>1</access_management>
    </${USER_NAME}>
  </users>
</clickhouse>
EOF

mkdir -p /var/lib/clickhouse /var/log/clickhouse-server
exec clickhouse server --config-file=/etc/clickhouse-server/config.xml
