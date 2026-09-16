extends SceneTree

const Api = preload("res://scripts/game_api.gd")

func _init() -> void:
	call_deferred("run")

func fail(message: String) -> void:
	push_error(message)
	quit(1)

func run() -> void:
	var host := Api.new(); root.add_child(host)
	var guest := Api.new(); root.add_child(guest)
	var created: Dictionary = await host.create_room("Anfitrião Godot", "character-male-a", 8)
	if not created.ok: fail(created.error); return
	var joined: Dictionary = await guest.join_room("Convidado Godot", "character-female-a", host.code)
	if not joined.ok: fail(joined.error); return
	var started: Dictionary = await host.action("start")
	if not started.ok or started.data.phase != "playing": fail("A partida Godot não iniciou."); return
	var rolled: Dictionary = await host.action("roll")
	if not rolled.ok or rolled.data.dice.size() != 2: fail("O lançamento não voltou do servidor."); return
	print("GODOT_API_OK sala=", host.code, " jogadores=", rolled.data.players.size(), " dados=", rolled.data.dice)
	quit(0)
