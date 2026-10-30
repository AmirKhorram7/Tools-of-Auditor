## the best way when you wanted restart docker 
# Daily start — no Hub download, no rebuild
docker compose up -d --no-build --pull never

# Only after YOU change code
docker compose build backend frontend
docker compose up -d --no-build
