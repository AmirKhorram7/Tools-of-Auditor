## what is the best way for handle docker at the projetcs 

1- use this way :
<
# Daily start — no Hub download, no rebuild
docker compose up -d --no-build --pull never

>

<


# Only after YOU change code
docker compose build backend frontend
docker compose up -d --no-build


>
