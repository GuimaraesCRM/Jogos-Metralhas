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
var escape_menu: PanelContainer
var setup_box: VBoxContainer
var escape_info: Label
var hud_card: PanelContainer
var portfolio_panel: PanelContainer
var portfolio_box: HBoxContainer
var portfolio_heading: Label
var preview_index := 0
var character_preview: SubViewport
var character_preview_root: Node3D
var preview_initialized := false
var online_heading: Label

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
	var board_edge := 17.0
	var corner_size := 3.25
	var tile_step := (board_edge * 2.0 - corner_size) / float(per_side - 1)
	var colors := [Color("ef9a9a"), Color("90caf9"), Color("ffe082"), Color("ce93d8"), Color("80cbc4"), Color("ffab91")]
	for index in count:
		var side := index / per_side
		var slot := index % per_side
		var offset := -board_edge + corner_size / 2.0 + tile_step * (slot - 0.5)
		var at := Vector3.ZERO
		var size := Vector3(tile_step - 0.08, 0.32, corner_size)
		if slot == 0:
			size = Vector3(corner_size, 0.38, corner_size)
			match side:
				0: at = Vector3(-board_edge, 0.38, board_edge)
				1: at = Vector3(board_edge, 0.38, board_edge)
				2: at = Vector3(board_edge, 0.38, -board_edge)
				_: at = Vector3(-board_edge, 0.38, -board_edge)
		else:
			match side:
				0: at = Vector3(offset, 0.35, board_edge)
				1: at = Vector3(board_edge, 0.35, -offset); size = Vector3(corner_size, 0.32, tile_step - 0.08)
				2: at = Vector3(-offset, 0.35, -board_edge)
				_: at = Vector3(-board_edge, 0.35, offset); size = Vector3(corner_size, 0.32, tile_step - 0.08)
		points.append(Vector3(at.x, at.y + size.y * 0.5 + 0.03, at.z))
		board_root.add_child(cube(size, colors[(index / 5) % colors.size()] if index % 5 == 0 else Color("f4f0df"), at))
	var title := Label3D.new(); title.text = "METRALHOPOLE"; title.font_size = 72; title.pixel_size = 0.018; title.modulate = Color("345c50"); title.outline_size = 4; title.position = Vector3(0, 0.3, -2.2); title.rotation_degrees.x = -90; board_root.add_child(title)

func label_board(board_data: Array) -> void:
	if board_labels_for == board_data.size(): return
	board_labels_for = board_data.size()
	for index in mini(board_data.size(), points.size()):
		var tile: Dictionary = board_data[index]; var label := Label3D.new(); var name := str(tile.get("name", "")); if name.length() > 16: name = name.left(15) + "…"
		label.text = name + ("\nR$ %d mil" % (int(tile.get("price", 0)) / 1000) if tile.has("price") else "")
		label.font_size = 28; label.pixel_size = 0.012; label.modulate = Color("203735"); label.outline_size = 3; label.outline_modulate = Color("ffffffcc"); label.position = points[index] + Vector3(0, 0.015, 0); label.rotation_degrees.x = -90
		board_root.add_child(label)
		if tile.get("type", "") == "property": add_group_strip(index, tile, board_data.size())

func add_group_strip(index: int, tile: Dictionary, count: int) -> void:
	var per_side := count / 4; var side := index / per_side
	var board_edge := 17.0; var corner_size := 3.25; var tile_step := (board_edge * 2.0 - corner_size) / float(per_side - 1)
	var size := Vector3(tile_step - 0.12, 0.07, 0.48)
	var offset := Vector3(0, 0.055, 0)
	match side:
		0: offset.z = 1.34
		1: size = Vector3(0.48, 0.07, tile_step - 0.12); offset.x = 1.34
		2: offset.z = -1.34
		_: size = Vector3(0.48, 0.07, tile_step - 0.12); offset.x = -1.34
	board_root.add_child(cube(size, Color(str(tile.get("color", "#d6d6d6"))), points[index] + offset))

func make_pawn() -> void:
	pawn = Node3D.new(); var visual := PLAYER.instantiate(); pawn.add_child(visual); add_child(pawn); fit_character(visual)
	pawn.position = points[0]

func fit_character(visual: Node3D) -> void:
	fit_model_to_height(visual, 1.75)

func fit_model_to_height(visual: Node3D, desired_height: float) -> void:
	var bounds := AABB(); var initialized := false
	for mesh: MeshInstance3D in visual.find_children("*", "MeshInstance3D", true, false):
		var transform := visual.global_transform.affine_inverse() * mesh.global_transform
		var current := transform * mesh.get_aabb()
		bounds = current if not initialized else bounds.merge(current); initialized = true
	if not initialized or bounds.size.y <= 0: return
	var factor := desired_height / bounds.size.y
	visual.scale = Vector3.ONE * factor
	visual.position.y = -bounds.position.y * factor

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
	layer.layer = 4
	hud_card = PanelContainer.new(); hud_card.position = Vector2(28, 26)
	hud_card.add_theme_stylebox_override("panel", panel_style(Color("162631dc"), 18, Color("ffffff20")))
	var label := RichTextLabel.new(); label.fit_content = true; label.custom_minimum_size = Vector2(390, 64)
	label.bbcode_enabled = true; label.text = "[font_size=24][b]METRALHOPOLE[/b][/font_size]\n[color=#b8c8d0][font_size=14]ARRASTE PARA GIRAR  •  RODA PARA ZOOM  •  ESC PARA MENU[/font_size][/color]"
	hud_card.add_child(label); layer.add_child(hud_card)
	add_child(layer)

func panel_style(color: Color, radius: int, border := Color.TRANSPARENT) -> StyleBoxFlat:
	var style := StyleBoxFlat.new(); style.bg_color = color; style.border_color = border
	style.set_border_width_all(1); style.set_corner_radius_all(radius)
	style.content_margin_left = 20; style.content_margin_right = 20; style.content_margin_top = 18; style.content_margin_bottom = 18
	return style

func make_ui_theme() -> Theme:
	var theme := Theme.new(); theme.default_font_size = 17
	var normal := panel_style(Color("243640ee"), 10, Color("ffffff18")); normal.content_margin_top = 11; normal.content_margin_bottom = 11
	var hover := panel_style(Color("38515ddd"), 10, Color("aeea74aa")); hover.content_margin_top = 11; hover.content_margin_bottom = 11
	var pressed := panel_style(Color("9bd064ee"), 10); pressed.content_margin_top = 11; pressed.content_margin_bottom = 11
	theme.set_stylebox("normal", "Button", normal); theme.set_stylebox("hover", "Button", hover); theme.set_stylebox("pressed", "Button", pressed)
	theme.set_color("font_color", "Button", Color("edf5f6")); theme.set_color("font_pressed_color", "Button", Color("142027"))
	var input := panel_style(Color("101c24dd"), 9, Color("ffffff24")); input.content_margin_top = 10; input.content_margin_bottom = 10
	theme.set_stylebox("normal", "LineEdit", input); theme.set_stylebox("normal", "OptionButton", normal); theme.set_stylebox("hover", "OptionButton", hover)
	theme.set_color("font_color", "Label", Color("edf5f6")); theme.set_color("font_color", "LineEdit", Color("edf5f6"))
	return theme

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT: dragging = event.pressed
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP: distance = max(22.0, distance - 3.0); update_camera()
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN: distance = min(70.0, distance + 3.0); update_camera()
	elif event is InputEventMouseMotion and dragging:
		yaw -= event.relative.x * 0.007
		pitch = clamp(pitch + event.relative.y * 0.005, -1.25, -0.3)
		update_camera()
	elif event.is_action_pressed("ui_cancel") and escape_menu: escape_menu.visible = not escape_menu.visible

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
	var layer := CanvasLayer.new(); layer.layer = 5; add_child(layer)
	var ui_root := Control.new(); ui_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); ui_root.theme = make_ui_theme(); layer.add_child(ui_root)
	online_panel = PanelContainer.new()
	online_panel.custom_minimum_size = Vector2(420, 0)
	online_panel.add_theme_stylebox_override("panel", panel_style(Color("172731e8"), 18, Color("ffffff22")))
	ui_root.add_child(online_panel)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(420, 0)
	online_panel.add_child(scroll)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(380, 0); box.add_theme_constant_override("separation", 10)
	scroll.add_child(box)
	online_heading = Label.new(); online_heading.text = "JOGAR ONLINE"; online_heading.add_theme_font_size_override("font_size", 25); box.add_child(online_heading)
	setup_box = VBoxContainer.new(); setup_box.add_theme_constant_override("separation", 9); box.add_child(setup_box)
	name_input = field(setup_box, "Seu nome", "Guilherme")
	endpoint_input = field(setup_box, "Servidor", "http://127.0.0.1:3000")
	code_input = field(setup_box, "Código da sala", "")
	size_input = OptionButton.new(); size_input.add_item("Até 8 jogadores", 8); size_input.add_item("Até 4 jogadores", 4); setup_box.add_child(size_input)
	var create_button := Button.new(); create_button.text = "HOSPEDAR SALA"; create_button.pressed.connect(create_online_room); setup_box.add_child(create_button)
	var join_button := Button.new(); join_button.text = "ENTRAR NA SALA"; join_button.pressed.connect(join_online_room); setup_box.add_child(join_button)
	var reconnect_button := Button.new(); reconnect_button.text = "RECONECTAR SESSÃO"; reconnect_button.pressed.connect(reconnect_session); setup_box.add_child(reconnect_button)
	online_status = Label.new(); online_status.text = "Inicie o servidor Node e crie ou entre em uma sala."; online_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; box.add_child(online_status)
	actions_box = VBoxContainer.new(); actions_box.add_theme_constant_override("separation", 6); box.add_child(actions_box)
	var timer := Timer.new(); timer.wait_time = 1.0; timer.autostart = true; timer.timeout.connect(poll_state); add_child(timer)
	make_escape_menu(ui_root)
	make_portfolio(ui_root)
	get_viewport().size_changed.connect(layout_ui); layout_ui()

func layout_ui() -> void:
	if not online_panel: return
	var viewport := get_viewport().get_visible_rect().size
	var width := clampf(viewport.x * 0.23, 390.0, 470.0)
	online_panel.position = Vector2(viewport.x - width - 28, 28)
	online_panel.size = Vector2(width, minf(viewport.y - 56, 690.0))
	if escape_menu: escape_menu.position = (viewport - escape_menu.custom_minimum_size) * 0.5
	if portfolio_panel:
		portfolio_panel.position = Vector2(28, viewport.y - 260)
		portfolio_panel.size = Vector2(minf(viewport.x - width - 84, 930), 232)

func make_portfolio(parent: Control) -> void:
	portfolio_panel = PanelContainer.new(); portfolio_panel.visible = false
	portfolio_panel.add_theme_stylebox_override("panel", panel_style(Color("152630e8"), 18, Color("ffffff22"))); parent.add_child(portfolio_panel)
	var outer := VBoxContainer.new(); outer.add_theme_constant_override("separation", 9); portfolio_panel.add_child(outer)
	portfolio_heading = Label.new(); portfolio_heading.text = "MEU PATRIMÔNIO"; portfolio_heading.add_theme_font_size_override("font_size", 20); outer.add_child(portfolio_heading)
	var scroll := ScrollContainer.new(); scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO; scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; outer.add_child(scroll)
	portfolio_box = HBoxContainer.new(); portfolio_box.add_theme_constant_override("separation", 10); scroll.add_child(portfolio_box)

func make_property_card(tile: Dictionary, lot: Dictionary) -> Control:
	var card := PanelContainer.new(); card.custom_minimum_size = Vector2(215, 145)
	var color := Color(str(tile.get("color", "#78909c"))); card.add_theme_stylebox_override("panel", panel_style(Color("20333ddd"), 12, color))
	var row := HBoxContainer.new(); row.add_theme_constant_override("separation", 8); card.add_child(row)
	var viewport_box := SubViewportContainer.new(); viewport_box.custom_minimum_size = Vector2(88, 105); viewport_box.stretch = true; row.add_child(viewport_box)
	var viewport := SubViewport.new(); viewport.size = Vector2i(128, 144); viewport.transparent_bg = true; viewport.own_world_3d = true; viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS; viewport_box.add_child(viewport)
	var root := Node3D.new(); viewport.add_child(root); root.add_child(cube(Vector3(1.8, 0.18, 1.5), color, Vector3.ZERO))
	var level := int(lot.get("level", 0)); var building_count := mini(level, 3)
	for index in building_count: root.add_child(cube(Vector3(0.34, 0.45, 0.34), Color("e6f2d5"), Vector3(-0.5 + index * 0.5, 0.31, 0)))
	if level == 4: root.add_child(cube(Vector3(1.0, 0.85, 0.55), Color("f1c56e"), Vector3(0, 0.52, 0)))
	var camera := Camera3D.new(); camera.position = Vector3(2.7, 2.5, 3.2); camera.look_at_from_position(camera.position, Vector3(0, 0.25, 0)); viewport.add_child(camera)
	var light := DirectionalLight3D.new(); light.rotation_degrees = Vector3(-55, -35, 0); light.light_energy = 1.8; viewport.add_child(light)
	var info := RichTextLabel.new(); info.bbcode_enabled = true; info.fit_content = true; info.text = "[b]%s[/b]\n[color=#aebfc7]%s[/color]\n%s" % [tile.name, tile.get("city", "Indústria"), "HOTEL" if level == 4 else "%d CASA(S)" % level if level > 0 else "SEM MELHORIA"]; info.custom_minimum_size.x = 92; row.add_child(info)
	return card

func add_character_selector(me: Dictionary, players: Array) -> void:
	var title := Label.new(); title.text = "ESCOLHA SEU PERSONAGEM"; title.add_theme_font_size_override("font_size", 19); actions_box.add_child(title)
	if not preview_initialized: preview_index = maxi(0, CHARACTERS.find(str(me.character))); preview_initialized = true
	var preview_box := SubViewportContainer.new(); preview_box.custom_minimum_size = Vector2(350, 215); preview_box.stretch = true; actions_box.add_child(preview_box)
	character_preview = SubViewport.new(); character_preview.size = Vector2i(700, 430); character_preview.transparent_bg = true; character_preview.own_world_3d = true; character_preview.render_target_update_mode = SubViewport.UPDATE_ALWAYS; preview_box.add_child(character_preview)
	character_preview_root = Node3D.new(); character_preview.add_child(character_preview_root)
	character_preview.add_child(cube(Vector3(1.75, 0.12, 1.75), Color("36505b"), Vector3(0, -0.05, 0)))
	var camera := Camera3D.new(); camera.current = true; camera.position = Vector3(0, 1.05, 2.45); camera.look_at_from_position(camera.position, Vector3(0, 0.88, 0)); character_preview.add_child(camera)
	var key := DirectionalLight3D.new(); key.rotation_degrees = Vector3(-35, -30, 0); key.light_energy = 2.0; character_preview.add_child(key)
	var fill := OmniLight3D.new(); fill.position = Vector3(-2, 2, 2); fill.light_energy = 5.0; fill.omni_range = 6; character_preview.add_child(fill)
	var controls := HBoxContainer.new(); controls.add_theme_constant_override("separation", 8); actions_box.add_child(controls)
	var previous := Button.new(); previous.text = "◀"; previous.custom_minimum_size.x = 54; controls.add_child(previous)
	var choose := Button.new(); choose.name = "ChooseCharacter"; choose.size_flags_horizontal = Control.SIZE_EXPAND_FILL; controls.add_child(choose)
	var next := Button.new(); next.text = "▶"; next.custom_minimum_size.x = 54; controls.add_child(next)
	var refresh := func():
		for child in character_preview_root.get_children(): child.queue_free()
		var selected: String = CHARACTERS[preview_index]; var used_by: String = ""
		for player in players:
			if player.id != api.player_id and player.character == selected: used_by = player.name
		var scene: PackedScene = load("res://assets/models/%s.glb" % selected); var model := scene.instantiate(); character_preview_root.add_child(model); fit_character(model)
		choose.disabled = not used_by.is_empty(); choose.text = "INDISPONÍVEL · %s" % used_by if not used_by.is_empty() else "SELECIONADO" if selected == me.character else "USAR ESTE PERSONAGEM"
	previous.pressed.connect(func(): preview_index = posmod(preview_index - 1, CHARACTERS.size()); refresh.call())
	next.pressed.connect(func(): preview_index = (preview_index + 1) % CHARACTERS.size(); refresh.call())
	choose.pressed.connect(func(): await send_action("set-character", CHARACTERS[preview_index]))
	refresh.call()

func make_escape_menu(layer: Control) -> void:
	escape_menu = PanelContainer.new(); escape_menu.visible = false; escape_menu.custom_minimum_size = Vector2(520, 440)
	escape_menu.add_theme_stylebox_override("panel", panel_style(Color("101c25f5"), 22, Color("b9e87d55"))); layer.add_child(escape_menu)
	var box := VBoxContainer.new(); box.add_theme_constant_override("separation", 14); escape_menu.add_child(box)
	var title := Label.new(); title.text = "MENU DA PARTIDA"; title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; title.add_theme_font_size_override("font_size", 30); box.add_child(title)
	box.add_child(HSeparator.new())
	escape_info = Label.new(); escape_info.text = "Nenhuma sala conectada."; escape_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; escape_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; box.add_child(escape_info)
	var pause_button := Button.new(); pause_button.text = "Pausar / retomar partida"; pause_button.pressed.connect(func():
		if not api.code.is_empty() and not game_state.is_empty(): await send_action("resume" if game_state.get("paused", false) else "pause")
	); box.add_child(pause_button)
	var leave_button := Button.new(); leave_button.text = "Sair da sala"; leave_button.pressed.connect(func():
		if not api.code.is_empty(): await send_action("leave"); escape_menu.visible = false
	); box.add_child(leave_button)
	var close_button := Button.new(); close_button.text = "VOLTAR AO JOGO"; close_button.pressed.connect(func(): escape_menu.visible = false); box.add_child(close_button)
	var quit_button := Button.new(); quit_button.text = "SAIR DO JOGO"; quit_button.pressed.connect(func(): get_tree().quit()); box.add_child(quit_button)

func field(parent: Control, placeholder: String, initial: String) -> LineEdit:
	var input := LineEdit.new(); input.placeholder_text = placeholder; input.text = initial; parent.add_child(input); return input

func create_online_room() -> void:
	api.endpoint = endpoint_input.text.strip_edges()
	set_online_status("Criando sala...")
	if api.endpoint.begins_with("http://127.0.0.1") or api.endpoint.begins_with("http://localhost"):
		if not await local_server.ensure_local_server(): set_online_status("Não foi possível iniciar o servidor local."); return
	var result := await api.create_room(name_input.text, "", size_input.get_item_id(size_input.selected))
	if not result.ok: set_online_status(result.error); return
	code_input.text = api.code
	save_session()
	var addresses: Array[String] = []
	for address in IP.get_local_addresses():
		if address.contains(".") and not address.begins_with("127."): addresses.append("http://%s:3000" % address)
	set_online_status("Sala %s criada. Compartilhe o código e um endereço:\n%s" % [api.code, "\n".join(addresses)])
	await poll_state()

func join_online_room() -> void:
	api.endpoint = endpoint_input.text.strip_edges()
	set_online_status("Entrando na sala...")
	var result := await api.join_room(name_input.text, "", code_input.text)
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
			model = Node3D.new(); var visual := scene.instantiate(); model.add_child(visual); add_child(model); fit_character(visual); player_nodes[data.id] = model
		var position_index := clampi(int(data.position), 0, points.size() - 1)
		var slot: int = index % 8
		var offset := Vector3((slot % 4 - 1.5) * 0.34, 0, (slot / 4 - 0.5) * 0.45)
		var movement: Dictionary = game_state.get("lastMove") if game_state.get("lastMove") is Dictionary else {}
		if movement.get("player", "") == data.id and int(movement.get("sequence", 0)) > last_move_sequence:
			animate_online_move(model, movement.get("path", []), offset)
		else:
			model.position = points[position_index] + offset
			var next := points[(position_index + 1) % points.size()] + offset
			model.look_at(Vector3(next.x, model.position.y, next.z), Vector3.UP, true)
		model.visible = not bool(data.get("bankrupt", false))
	for id in player_nodes.keys():
		if not alive.has(id): player_nodes[id].queue_free(); player_nodes.erase(id)
	var last_move: Dictionary = game_state.get("lastMove") if game_state.get("lastMove") is Dictionary else {}
	last_move_sequence = maxi(last_move_sequence, int(last_move.get("sequence", 0)))

func animate_online_move(model: Node3D, path: Array, offset: Vector3) -> void:
	var tween := create_tween()
	for raw_position in path:
		var index := clampi(int(raw_position), 0, points.size() - 1); var target := points[index] + offset
		tween.tween_callback(func(): model.look_at(Vector3(target.x, model.position.y, target.z), Vector3.UP, true))
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
		var outward := Vector3(points[id].x, 0, points[id].z).normalized()
		var root := Node3D.new(); root.position = points[id] - outward * 0.62; add_child(root); construction_nodes[raw_id] = root
		var marker := cube(Vector3(0.72, 0.045, 0.24), palette[owner_index % palette.size()], Vector3(0, -0.07, 0)); root.add_child(marker)
		var level := int(lot.get("level", 0))
		if level > 0:
			var filename := "Hotel" if level == 4 else "%d casa%s" % [level, "" if level == 1 else "s"]
			var scene: PackedScene = load("res://assets/models/%s.glb" % filename)
			var building := scene.instantiate(); root.add_child(building); fit_model_to_height(building, 1.05 if level == 4 else 0.72)

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
	setup_box.visible = false
	online_heading.text = "LOBBY DA SALA" if phase == "lobby" else "CENTRAL DA PARTIDA"
	set_online_status("Sala %s · %d/%d jogadores\n%s · R$ %d" % [api.code, players.size(), int(game_state.get("maxPlayers", 8)), me.name, int(me.money)])
	if escape_info:
		var names: Array[String] = []
		for player in players: names.append("• %s%s" % [player.name, "  ·  R$ %d" % int(player.money) if phase != "lobby" else ""])
		escape_info.text = "SALA %s  ·  %d/%d JOGADORES\n\n%s" % [api.code, players.size(), int(game_state.get("maxPlayers", 8)), "\n".join(names)]
	update_portfolio(me)
	var logs: Array = game_state.get("logs", []); if not logs.is_empty(): online_status.text += "\n\n" + "\n".join(logs.slice(maxi(0, logs.size() - 4)))
	if phase == "lobby":
		var roster_title := Label.new(); roster_title.text = "JOGADORES  ·  %d/%d" % [players.size(), int(game_state.get("maxPlayers", 8))]; roster_title.add_theme_font_size_override("font_size", 18); actions_box.add_child(roster_title)
		var roster := HFlowContainer.new(); roster.add_theme_constant_override("h_separation", 6); roster.add_theme_constant_override("v_separation", 6); actions_box.add_child(roster)
		for player in players:
			var chip := Label.new(); chip.text = "  %s  " % player.name; chip.add_theme_stylebox_override("normal", panel_style(Color("304752cc"), 9, Color("ffffff1f"))); roster.add_child(chip)
		add_character_selector(me, players)
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

func update_portfolio(me: Dictionary) -> void:
	portfolio_panel.visible = str(game_state.get("phase", "lobby")) != "lobby"
	if not portfolio_panel.visible: return
	portfolio_heading.text = "MEU PATRIMÔNIO  ·  R$ %s" % format_money(int(me.money))
	for child in portfolio_box.get_children(): child.queue_free()
	for raw_id in game_state.get("properties", {}):
		var lot: Dictionary = game_state.properties[raw_id]
		if lot.owner == api.player_id: portfolio_box.add_child(make_property_card(game_state.board[int(raw_id)], lot))
	if portfolio_box.get_child_count() == 0:
		var empty := Label.new(); empty.text = "Você ainda não possui propriedades."; empty.add_theme_color_override("font_color", Color("aebfc7")); portfolio_box.add_child(empty)

func format_money(value: int) -> String:
	var raw := str(value); var result := ""
	while raw.length() > 3:
		result = "." + raw.right(3) + result; raw = raw.left(raw.length() - 3)
	return raw + result

func send_action(action: String, value: Variant = null) -> void:
	var result := await api.action(action, value)
	if not result.ok: set_online_status(result.error); return
	if action == "leave":
		api.code = ""; api.token = ""; api.player_id = ""; game_state = {}; setup_box.visible = true; preview_initialized = false; portfolio_panel.visible = false
		set_online_status("Você saiu da sala. Crie uma nova sala ou entre em outra.")
		DirAccess.remove_absolute(ProjectSettings.globalize_path("user://session.cfg")); return
	apply_server_state(result.data)
