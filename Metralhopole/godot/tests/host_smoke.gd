extends SceneTree
const Manager = preload("res://scripts/server_manager.gd")
const Api = preload("res://scripts/game_api.gd")
func _init() -> void: call_deferred("run")
func run() -> void:
	var manager := Manager.new(); root.add_child(manager)
	if not await manager.ensure_local_server(): push_error("Godot não iniciou o anfitrião local."); quit(1); return
	var api := Api.new(); root.add_child(api)
	var result: Dictionary = await api.create_room("Host integrado", "character-male-a", 4)
	if not result.ok: push_error(result.error); quit(1); return
	print("GODOT_HOST_OK sala=", api.code)
	quit(0)
