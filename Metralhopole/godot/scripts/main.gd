extends Node3D

const TILES := 60
const PER_SIDE := 15
const STEP := 2.25
const EDGE := 16.875
const PLAYER := preload("res://assets/models/character-male-a.glb")
const API_SCRIPT := preload("res://scripts/game_api.gd")
const SERVER_SCRIPT := preload("res://scripts/server_manager.gd")
const CHARACTERS := ["character-female-a", "character-female-b", "character-female-c", "character-female-d", "character-female-e", "character-female-f", "character-male-a", "character-male-b", "character-male-c", "character-male-d", "character-male-e", "character-male-f"]
var points: Array[Vector3] = []
var pawn: Node3D
var pawn_index := 0
var dice: Array[RigidBody3D] = []
var yaw := -0.7
var pitch := -0.72
var distance := 48.0
var dragging := false
var rng := RandomNumberGenerator.new()
var api: GameApi
var local_server: Node
var game_state: Dictionary = {}
var player_nodes := {}
var online_panel: PanelContainer
var online_status: Label
var actions_box: VBoxContainer
var name_input: LineEdit
var endpoint_input: LineEdit
var code_input: LineEdit
var character_input: OptionButton
var size_input: OptionButton
var polling := false
var board_root: Node3D
var construction_nodes := {}
var last_move_sequence := 0
var board_labels_for := 0

func _ready() -> void:
	rng.randomize()
	make_world()
	make_board()
	var board_file := FileAccess.get_file_as_string("res://data/boards.json"); var board_data = JSON.parse_string(board_file)
	if board_data is Dictionary: label_board(board_data.large)
	make_pawn()
	make_dice()
	make_camera()
	make_hud()
	make_online_ui()

func mat(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.72
	return m

func cube(size: Vector3, color: Color, at: Vector3) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = mat(color)
	node.mesh = mesh
	node.position = at
	return node

func make_world() -> void:
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("8ec8df")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_energy = 0.7
	world.environment = env
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -35, 0)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	add_child(sun)
	add_child(cube(Vector3(39.5, 0.8, 39.5), Color("526b64"), Vector3(0, -0.6, 0)))
	add_child(cube(Vector3(35.0, 0.35, 35.0), Color("a9c7a8"), Vector3.ZERO))
	var floor_body := StaticBody3D.new()
	var floor_shape := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(35, 0.4, 35)
	floor_shape.shape = shape
	floor_body.position.y = 0.15
	floor_body.add_child(floor_shape)
	add_child(floor_body)

func make_board(count := TILES) -> void:
	if board_root and is_instance_valid(board_root): board_root.free()
	board_root = Node3D.new(); board_root.name = "CasasDoTabuleiro"; add_child(board_root); points.clear()
	board_labels_for = 0
	var per_side := count / 4
	var tile_step := 2.25 if count == 60 else 3.35
	var board_edge := tile_step * per_side / 2.0
	var colors := [Color("ef9a9a"), Color("90caf9"), Color("ffe082"), Color("ce93d8"), Color("80cbc4"), Color("ffab91")]
	for index in count:
		var side := index / per_side
		var slot := index % per_side
		var offset := -board_edge + tile_step * (slot + 0.5)
		var at := Vector3.ZERO
		var size := Vector3(tile_step - 0.08, 0.32, 3.1)
		match side:
			0: at = Vector3(offset, 0.35, board_edge)
			1: at = Vector3(board_edge, 0.35, -offset); size = Vector3(3.1, 0.32, tile_step - 0.08)
			2: at = Vector3(-offset, 0.35, -board_edge)
			_: at = Vector3(-board_edge, 0.35, offset); size = Vector3(3.1, 0.32, tile_step - 0.08)
		points.append(at + Vector3(0, 0.65, 0))
		board_root.add_child(cube(size, colors[(index / 5) % colors.size()] if index % 5 == 0 else Color("f4f0df"), at))
	var title := Label3D.new(); title.text = "METRALHOPOLE"; title.font_size = 72; title.pixel_size = 0.018; title.modulate = Color("345c50"); title.outline_size = 4; title.position = Vector3(0, 0.3, -2.2); title.rotation_degrees.x = -90; board_root.add_child(title)

func label_board(board_data: Array) -> void:
	if board_labels_for == board_data.size(): return
	board_labels_for = board_data.size()
	for index in mini(board_data.size(), points.size()):
		var tile: Dictionary = board_data[index]; var label := Label3D.new(); var name := str(tile.get("name", "")); if name.length() > 16: name = name.left(15) + "…"
		label.text = name + ("\nR$ %d mil" % (int(tile.get("price", 0)) / 1000) if tile.has("price") else "")
		label.font_size = 28; label.pixel_size = 0.012; label.modulate = Color("203735"); label.outline_size = 3; label.outline_modulate = Color("ffffffcc"); label.position = points[index] + Vector3(0, -0.17, 0); label.rotation_degrees.x = -90
		board_root.add_child(label)

func make_pawn() -> void:
	pawn = PLAYER.instantiate()
	pawn.scale = Vector3.ONE * 0.72
	pawn.position = points[0]
	add_child(pawn)

func make_dice() -> void:
	for index in 2:
		var body := RigidBody3D.new()
		body.position = Vector3(-2 + index * 4, 3, 0)
		body.freeze = true
		body.add_child(cube(Vector3.ONE * 1.65, Color("f8f4e8"), Vector3.ZERO))
		var collision := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3.ONE * 1.65
		collision.shape = shape
		body.add_child(collision)
		add_die_pips(body)
		add_child(body)
		dice.append(body)

func add_die_pips(body: Node3D) -> void:
	var layouts := {1: [Vector2.ZERO], 2: [Vector2(-0.35, 0.35), Vector2(0.35, -0.35)], 3: [Vector2(-0.35, 0.35), Vector2.ZERO, Vector2(0.35, -0.35)], 4: [Vector2(-0.35, -0.35), Vector2(-0.35, 0.35), Vector2(0.35, -0.35), Vector2(0.35, 0.35)], 5: [Vector2(-0.35, -0.35), Vector2(-0.35, 0.35), Vector2.ZERO, Vector2(0.35, -0.35), Vector2(0.35, 0.35)], 6: [Vector2(-0.35, -0.42), Vector2(-0.35, 0), Vector2(-0.35, 0.42), Vector2(0.35, -0.42), Vector2(0.35, 0), Vector2(0.35, 0.42)]}
	var faces := {1: [Vector3.UP, Vector3.RIGHT, Vector3.FORWARD], 6: [Vector3.DOWN, Vector3.RIGHT, Vector3.BACK], 2: [Vector3.FORWARD, Vector3.RIGHT, Vector3.UP], 5: [Vector3.BACK, Vector3.LEFT, Vector3.UP], 3: [Vector3.RIGHT, Vector3.BACK, Vector3.UP], 4: [Vector3.LEFT, Vector3.FORWARD, Vector3.UP]}
	for value in faces:
		var face: Array = faces[value]
		for spot: Vector2 in layouts[value]:
			var pip := MeshInstance3D.new(); var sphere := SphereMesh.new(); sphere.radius = 0.105; sphere.height = 0.21; sphere.material = mat(Color("172b3c")); pip.mesh = sphere
			pip.position = face[0] * 0.835 + face[1] * spot.x + face[2] * spot.y
			body.add_child(pip)

func make_camera() -> void:
	var camera := Camera3D.new()
	camera.name = "Camera3D"
	camera.current = true
	camera.fov = 42
	add_child(camera)
	update_camera()

func update_camera() -> void:
	var camera := get_node("Camera3D") as Camera3D
	var direction := Vector3(cos(pitch) * sin(yaw), sin(-pitch), cos(pitch) * cos(yaw))
	camera.position = direction * distance
	camera.look_at(Vector3.ZERO)

func make_hud() -> void:
	var layer := CanvasLayer.new()
	var label := Label.new()
	label.position = Vector2(24, 24)
	label.text = "METRALHOPOLE 3D · GODOT 4\nESPAÇO: física dos dados · M: mover peão\nArraste: câmera · Roda: zoom"
	label.add_theme_font_size_override("font_size", 20)
	layer.add_child(label)
	add_child(layer)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT: dragging = event.pressed
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP: distance = max(22.0, distance - 3.0); update_camera()
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN: distance = min(70.0, distance + 3.0); update_camera()
	elif event is InputEventMouseMotion and dragging:
		yaw -= event.relative.x * 0.007
		pitch = clamp(pitch + event.relative.y * 0.005, -1.25, -0.3)
		update_camera()
	elif event.is_action_pressed("roll_dice"): roll_dice()
	elif event.is_action_pressed("move_demo"): move_pawn(rng.randi_range(2, 12))

func roll_dice() -> void:
	for index in dice.size():
		var body := dice[index]
		body.freeze = false
		body.position = Vector3(-7 + index * 3, 8 + index, -3 + index)
		body.rotation = Vector3(rng.randf_range(0, TAU), rng.randf_range(0, TAU), rng.randf_range(0, TAU))
		body.linear_velocity = Vector3(rng.randf_range(5, 10), rng.randf_range(1, 4), rng.randf_range(2, 7))
		body.angular_velocity = Vector3(rng.randf_range(-14, 14), rng.randf_range(-14, 14), rng.randf_range(-14, 14))

func move_pawn(amount: int) -> void:
	var tween := create_tween()
	for count in amount:
		pawn_index = (pawn_index + 1) % TILES
		var target := points[pawn_index]
		tween.tween_property(pawn, "position", target + Vector3.UP * 0.4, 0.18)
		tween.tween_property(pawn, "position", target, 0.1)

func make_online_ui() -> void:
	api = API_SCRIPT.new()
	add_child(api)
	local_server = SERVER_SCRIPT.new(); add_child(local_server)
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	online_panel = PanelContainer.new()
	online_panel.position = Vector2(24, 125)
	online_panel.custom_minimum_size = Vector2(360, 520)
	layer.add_child(online_panel)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(360, 520)
	online_panel.add_child(scroll)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(330, 0)
	box.add_theme_constant_override("separation", 8)
	scroll.add_child(box)
	name_input = field(box, "Seu nome", "Guilherme")
	endpoint_input = field(box, "Servidor", "http://127.0.0.1:3000")
	code_input = field(box, "Código da sala", "")
	character_input = OptionButton.new()
	for character in CHARACTERS: character_input.add_item(character)
	character_input.select(6)
	box.add_child(character_input)
	size_input = OptionButton.new(); size_input.add_item("Até 8 jogadores", 8); size_input.add_item("Até 4 jogadores", 4); box.add_child(size_input)
	var create_button := Button.new(); create_button.text = "Hospedar sala"; create_button.pressed.connect(create_online_room); box.add_child(create_button)
	var join_button := Button.new(); join_button.text = "Entrar na sala"; join_button.pressed.connect(join_online_room); box.add_child(join_button)
	var reconnect_button := Button.new(); reconnect_button.text = "Reconectar sessão salva"; reconnect_button.pressed.connect(reconnect_session); box.add_child(reconnect_button)
	online_status = Label.new(); online_status.text = "Inicie o servidor Node e crie ou entre em uma sala."; online_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; box.add_child(online_status)
	actions_box = VBoxContainer.new(); actions_box.add_theme_constant_override("separation", 6); box.add_child(actions_box)
	var timer := Timer.new(); timer.wait_time = 1.0; timer.autostart = true; timer.timeout.connect(poll_state); add_child(timer)

func field(parent: Control, placeholder: String, initial: String) -> LineEdit:
	var input := LineEdit.new(); input.placeholder_text = placeholder; input.text = initial; parent.add_child(input); return input

func create_online_room() -> void:
	api.endpoint = endpoint_input.text.strip_edges()
	set_online_status("Criando sala...")
	if api.endpoint.begins_with("http://127.0.0.1") or api.endpoint.begins_with("http://localhost"):
		if not await local_server.ensure_local_server(): set_online_status("Não foi possível iniciar o servidor local."); return
	var result := await api.create_room(name_input.text, CHARACTERS[character_input.selected], size_input.get_item_id(size_input.selected))
	if not result.ok: set_online_status(result.error); return
	code_input.text = api.code
	save_session()
	set_online_status("Sala %s criada. Compartilhe o endereço e o código." % api.code)
	await poll_state()

func join_online_room() -> void:
	api.endpoint = endpoint_input.text.strip_edges()
	set_online_status("Entrando na sala...")
	var result := await api.join_room(name_input.text, CHARACTERS[character_input.selected], code_input.text)
	if not result.ok: set_online_status(result.error); return
	save_session()
	set_online_status("Conectado à sala %s." % api.code)
	await poll_state()

func poll_state() -> void:
	if api == null or api.code.is_empty() or polling: return
	polling = true
	var result := await api.state()
	polling = false
	if not result.ok: set_online_status(result.error); return
	apply_server_state(result.data)

func set_online_status(text: String) -> void:
	if online_status: online_status.text = text

func save_session() -> void:
	var config := ConfigFile.new(); config.set_value("session", "endpoint", api.endpoint); config.set_value("session", "code", api.code); config.set_value("session", "token", api.token); config.set_value("session", "id", api.player_id); config.save("user://session.cfg")

func reconnect_session() -> void:
	var config := ConfigFile.new()
	if config.load("user://session.cfg") != OK: set_online_status("Nenhuma sessão salva."); return
	api.endpoint = config.get_value("session", "endpoint", ""); api.code = config.get_value("session", "code", ""); api.token = config.get_value("session", "token", ""); api.player_id = config.get_value("session", "id", "")
	endpoint_input.text = api.endpoint; code_input.text = api.code; await poll_state()

func apply_server_state(latest: Dictionary) -> void:
	var previous_roll := int(game_state.get("rollSequence", 0))
	game_state = latest
	if points.size() != latest.get("board", []).size(): make_board(latest.board.size())
	label_board(latest.get("board", []))
	if pawn and is_instance_valid(pawn): pawn.visible = false
	sync_online_players()
	sync_constructions()
	if int(latest.get("rollSequence", 0)) > previous_roll and latest.get("dice", []).size() == 2: launch_server_dice(latest.dice)
	render_actions()

func sync_online_players() -> void:
	var alive := {}
	for index in game_state.get("players", []).size():
		var data: Dictionary = game_state.players[index]
		alive[data.id] = true
		var model: Node3D = player_nodes.get(data.id)
		if model == null:
			var scene: PackedScene = load("res://assets/models/%s.glb" % data.character)
			model = scene.instantiate(); model.scale = Vector3.ONE * 0.72; add_child(model); player_nodes[data.id] = model
		var position_index := clampi(int(data.position), 0, points.size() - 1)
		var slot: int = index % 8
		var offset := Vector3((slot % 4 - 1.5) * 0.34, 0, (slot / 4 - 0.5) * 0.45)
		var movement: Dictionary = game_state.get("lastMove", {})
		if movement.get("player", "") == data.id and int(movement.get("sequence", 0)) > last_move_sequence:
			animate_online_move(model, movement.get("path", []), offset)
		else: model.position = points[position_index] + offset
		model.visible = not bool(data.get("bankrupt", false))
	for id in player_nodes.keys():
		if not alive.has(id): player_nodes[id].queue_free(); player_nodes.erase(id)
	last_move_sequence = maxi(last_move_sequence, int(game_state.get("lastMove", {}).get("sequence", 0)))

func animate_online_move(model: Node3D, path: Array, offset: Vector3) -> void:
	var tween := create_tween()
	for raw_position in path:
		var index := clampi(int(raw_position), 0, points.size() - 1); var target := points[index] + offset
		tween.tween_property(model, "position", target + Vector3.UP * 0.35, 0.11)
		tween.tween_property(model, "position", target, 0.07)

func sync_constructions() -> void:
	for node in construction_nodes.values(): node.queue_free()
	construction_nodes.clear()
	var palette := [Color("c6f185"), Color("7bc6f1"), Color("ee98b3"), Color("eac776"), Color("bca1ef"), Color("76d9c2"), Color("f2a477"), Color("d4dee8")]
	for raw_id in game_state.get("properties", {}):
		var id := int(raw_id); if id < 0 or id >= points.size(): continue
		var lot: Dictionary = game_state.properties[raw_id]; var owner_index := 0
		for index in game_state.players.size():
			if game_state.players[index].id == lot.owner: owner_index = index
		var root := Node3D.new(); root.position = points[id] - points[id].normalized() * 0.62; add_child(root); construction_nodes[raw_id] = root
		var marker := cube(Vector3(0.34, 0.22, 0.34), palette[owner_index % palette.size()], Vector3(0, 0.12, 0)); root.add_child(marker)
		var level := int(lot.get("level", 0))
		if level > 0:
			var filename := "Hotel" if level == 4 else "%d casa%s" % [level, "" if level == 1 else "s"]
			var scene: PackedScene = load("res://assets/models/%s.glb" % filename)
			var building := scene.instantiate(); building.scale = Vector3.ONE * 0.38; building.position.y = 0.2; root.add_child(building)

func launch_server_dice(values: Array) -> void:
	for index in min(2, dice.size()):
		var body := dice[index]; body.freeze = false; body.position = Vector3(-7 + index * 3, 8 + index, -3 + index)
		body.rotation = Vector3(rng.randf_range(0, TAU), rng.randf_range(0, TAU), rng.randf_range(0, TAU))
		body.linear_velocity = Vector3(rng.randf_range(5, 10), 2.5, rng.randf_range(2, 7)); body.angular_velocity = Vector3(10 + values[index], -12 + values[index], 9)
	settle_server_dice(values)

func settle_server_dice(values: Array) -> void:
	await get_tree().create_timer(1.7).timeout
	for index in min(2, dice.size()):
		var body := dice[index]; body.freeze = true; body.angular_velocity = Vector3.ZERO; body.linear_velocity = Vector3.ZERO
		var value := int(values[index]); var target := Vector3.ZERO
		match value:
			2: target.x = -PI / 2.0
			3: target.z = PI / 2.0
			4: target.z = -PI / 2.0
			5: target.x = PI / 2.0
			6: target.x = PI
		body.rotation = target + Vector3(0, rng.randf_range(-0.45, 0.45), 0)

func action_button(label: String, action: String, value: Variant = null) -> void:
	var button := Button.new(); button.text = label; button.pressed.connect(func(): await send_action(action, value)); actions_box.add_child(button)

func render_actions() -> void:
	for child in actions_box.get_children(): child.queue_free()
	var players: Array = game_state.get("players", [])
	var me: Dictionary = {}
	for candidate in players:
		if candidate.id == api.player_id: me = candidate
	if me.is_empty(): return
	var phase := str(game_state.get("phase", "lobby")); var stage := str(game_state.get("stage", "roll"))
	set_online_status("Sala %s · %d/%d jogadores\n%s · R$ %d" % [api.code, players.size(), int(game_state.get("maxPlayers", 8)), me.name, int(me.money)])
	var logs: Array = game_state.get("logs", []); if not logs.is_empty(): online_status.text += "\n\n" + "\n".join(logs.slice(maxi(0, logs.size() - 4)))
	if phase == "lobby":
		if players[0].id == api.player_id: action_button("Iniciar partida", "start")
		action_button("Sair da sala", "leave")
		return
	var current: Dictionary = players[int(game_state.get("turn", 0))]
	var current_label := Label.new(); current_label.text = "Turno: %s · etapa: %s" % [current.name, stage]; actions_box.add_child(current_label)
	action_button("Pausar" if not game_state.get("paused", false) else "Retomar", "pause" if not game_state.get("paused", false) else "resume")
	var offer: Dictionary = game_state.get("trade", {}) if game_state.get("trade") != null else {}
	if not offer.is_empty():
		if offer.get("to", "") == api.player_id:
			action_button("Aceitar oferta", "trade-accept", offer.id); action_button("Recusar oferta", "trade-reject", offer.id)
		elif offer.get("from", "") == api.player_id: action_button("Cancelar oferta", "trade-cancel", offer.id)
	if current.id != api.player_id: return
	if stage == "roll":
		action_button("Lançar dados", "roll")
		if me.get("jailed", false):
			action_button("Cumprir rodada na prisão", "jail-wait")
			if int(me.get("jailCards", 0)) > 0: action_button("Usar carta de saída", "jail-card")
	elif stage == "buy": action_button("Comprar propriedade", "buy")
	elif stage == "upgrade":
		var property := int(me.position); var lot: Dictionary = game_state.properties.get(str(property), {}); var maximum := 4 if int(lot.get("visits", 0)) >= 3 else 3
		for level in range(int(lot.get("level", 0)) + 1, maximum + 1): action_button("Construir nível %d" % level, "upgrade", {"property": property, "level": level})
	elif stage == "rent":
		action_button("Confirmar aluguel", "rent-confirm"); action_button("Venda automática ao banco", "sell-bank-auto")
		for raw_id in game_state.get("properties", {}):
			if game_state.properties[raw_id].owner == api.player_id: action_button("Vender %s ao banco" % game_state.board[int(raw_id)].name, "sell-bank", int(raw_id))
		action_button("Declarar falência", "declare-bankruptcy")
	elif stage == "choice":
		var choice: Dictionary = game_state.get("pendingChoice", {})
		for tile in game_state.get("board", []):
			var lot: Dictionary = game_state.get("properties", {}).get(str(tile.id), {}); var eligible := false
			if choice.type == "joker": eligible = (tile.type == "property" or tile.type == "industry") and lot.is_empty()
			elif choice.type == "carnival": eligible = tile.type == "property" and lot.get("owner", "") == api.player_id
			else: eligible = tile.type == "property" and not lot.is_empty() and lot.get("owner", "") != api.player_id
			if eligible: action_button("Escolher %s" % tile.name, "card-choice", tile.id)
	if stage != "roll" and stage != "rent" and stage != "choice": action_button("Encerrar turno", "end")
	if offer.is_empty(): add_trade_controls(me)
	action_button("Sair da partida", "leave")

func add_trade_controls(me: Dictionary) -> void:
	var targets: Array = game_state.players.filter(func(player): return player.id != api.player_id and not player.get("bankrupt", false))
	if targets.is_empty(): return
	var heading := Label.new(); heading.text = "Negociar propriedade"; actions_box.add_child(heading)
	var kind := OptionButton.new(); kind.add_item("Comprar", 0); kind.add_item("Vender", 1); actions_box.add_child(kind)
	var target := OptionButton.new(); for player in targets: target.add_item(player.name); target.set_item_metadata(target.item_count - 1, player.id); actions_box.add_child(target)
	var property := OptionButton.new(); actions_box.add_child(property)
	var refresh := func():
		property.clear(); var selling := kind.selected == 1; var owner_id = api.player_id if selling else target.get_item_metadata(target.selected)
		for raw_id in game_state.properties:
			if game_state.properties[raw_id].owner == owner_id: property.add_item(game_state.board[int(raw_id)].name); property.set_item_metadata(property.item_count - 1, int(raw_id))
	kind.item_selected.connect(func(_value): refresh.call()); target.item_selected.connect(func(_value): refresh.call()); refresh.call()
	var price := LineEdit.new(); price.placeholder_text = "Valor da oferta em reais"; actions_box.add_child(price)
	var send := Button.new(); send.text = "Enviar oferta"; send.pressed.connect(func():
		if property.item_count == 0: set_online_status("Não há propriedade disponível para a oferta."); return
		await send_action("trade-offer", {"type": "sell" if kind.selected == 1 else "buy", "target": target.get_item_metadata(target.selected), "property": property.get_item_metadata(property.selected), "price": int(price.text)})
	); actions_box.add_child(send)

func send_action(action: String, value: Variant = null) -> void:
	var result := await api.action(action, value)
	if not result.ok: set_online_status(result.error); return
	if action == "leave": api.code = ""; api.token = ""; api.player_id = ""; DirAccess.remove_absolute(ProjectSettings.globalize_path("user://session.cfg"))
	apply_server_state(result.data)
