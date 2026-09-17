class_name GameApi
extends Node

var endpoint := "http://127.0.0.1:3000"
var code := ""
var token := ""
var player_id := ""

func send(path: String, body: Variant = null) -> Dictionary:
	var request := HTTPRequest.new()
	request.timeout = 8.0
	add_child(request)
	var headers := PackedStringArray(["Content-Type: application/json"])
	if not token.is_empty(): headers.append("Authorization: Bearer " + token)
	var method := HTTPClient.METHOD_GET if body == null else HTTPClient.METHOD_POST
	var payload := "" if body == null else JSON.stringify(body)
	var error := request.request(endpoint.trim_suffix("/") + path, headers, method, payload)
	if error != OK:
		request.queue_free()
		return {"ok": false, "error": "Não foi possível iniciar a conexão."}
	var completed: Array = await request.request_completed
	request.queue_free()
	var status: int = completed[1]
	var text := (completed[3] as PackedByteArray).get_string_from_utf8()
	var parsed = JSON.parse_string(text)
	if status < 200 or status >= 300:
		return {"ok": false, "error": parsed.get("error", "Falha na conexão.") if parsed is Dictionary else "Resposta inválida do servidor."}
	return {"ok": true, "data": parsed}

func create_room(name: String, character: String, maximum: int) -> Dictionary:
	var result := await send("/api/create", {"name": name, "character": character, "maxPlayers": maximum})
	if result.ok:
		code = result.data.code; token = result.data.token; player_id = result.data.id
	return result

func join_room(name: String, character: String, room_code: String) -> Dictionary:
	var result := await send("/api/join", {"name": name, "character": character, "code": room_code.to_upper()})
	if result.ok:
		code = result.data.code; token = result.data.token; player_id = result.data.id
	return result

func state() -> Dictionary:
	return await send("/api/state?code=" + code)

func action(name: String, value: Variant = null) -> Dictionary:
	return await send("/api/action", {"code": code, "action": name, "value": value})
