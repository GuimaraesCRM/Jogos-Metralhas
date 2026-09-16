extends Node3D

const TILES := 60
const PER_SIDE := 15
const STEP := 2.25
const EDGE := 16.875
const PLAYER := preload("res://assets/models/character-male-a.glb")
var points: Array[Vector3] = []
var pawn: Node3D
var pawn_index := 0
var dice: Array[RigidBody3D] = []
var yaw := -0.7
var pitch := -0.72
var distance := 48.0
var dragging := false
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()
	make_world()
	make_board()
	make_pawn()
	make_dice()
	make_camera()
	make_hud()

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

func make_board() -> void:
	var colors := [Color("ef9a9a"), Color("90caf9"), Color("ffe082"), Color("ce93d8"), Color("80cbc4"), Color("ffab91")]
	for index in TILES:
		var side := index / PER_SIDE
		var slot := index % PER_SIDE
		var offset := -EDGE + STEP * (slot + 0.5)
		var at := Vector3.ZERO
		var size := Vector3(STEP - 0.08, 0.32, 3.1)
		match side:
			0: at = Vector3(offset, 0.35, EDGE)
			1: at = Vector3(EDGE, 0.35, -offset); size = Vector3(3.1, 0.32, STEP - 0.08)
			2: at = Vector3(-offset, 0.35, -EDGE)
			_: at = Vector3(-EDGE, 0.35, offset); size = Vector3(3.1, 0.32, STEP - 0.08)
		points.append(at + Vector3(0, 0.65, 0))
		add_child(cube(size, colors[(index / 5) % colors.size()] if index % 5 == 0 else Color("f4f0df"), at))

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
		add_child(body)
		dice.append(body)

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
