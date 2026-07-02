-- Incremento: categoría de producto + alta de Desengrasante Logiclean
--
-- Agrega `categoria` a producto_base para agrupar el catálogo en el listado
-- del gerente y del vendedor. Categorías: escobas, trapeadores, recogedores,
-- papel_institucional, quimicos.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE por id (no depende de orden
-- de ejecución) + INSERT ... ON CONFLICT (id) DO NOTHING para el producto nuevo.

ALTER TABLE producto_base ADD COLUMN IF NOT EXISTS categoria TEXT;

-- Backfill del catálogo existente (34 productos, ver supabase/seed/catalog.sql)
UPDATE producto_base SET categoria = 'escobas' WHERE id IN (
  'befa967a-b254-5627-8be2-d0dc131e7f52', -- Escoba mixta 6 hilos La Moderna
  'ac53244a-c78d-5c17-9c85-8b7e9d3260e6', -- Escoba de mijo 6 hilos La Moderna
  'c57079f7-239c-5a10-9a50-a574cad92197', -- Escoba industrial con aro 8 hilos La Moderna
  'e7e3e8c1-0d68-57cd-94e1-7e08d5647340', -- Escoba de popotillo de coco roja La Moderna
  'd9a57e67-cff6-5e93-b7aa-840c67182c92', -- Escoba de popotillo de coco gris La Moderna
  '5b2dc1bd-2308-5290-8635-c137f88b3e75', -- Escoba de plástico 7 hilos La Moderna
  'f5aae65c-e82f-5028-899a-d2dcba7b19f4', -- Escoba de abanico larga
  'e9b754cd-121d-5e1b-b916-e755f3a5e0a5'  -- Escoba de abanico corta
);

UPDATE producto_base SET categoria = 'trapeadores' WHERE id IN (
  'cc183a49-b182-54de-924c-1e4fae2dcbf5', -- Trapeador rayón No. 4
  '67a2e7d5-152c-5d6b-9340-46e5b3bd4dfb', -- Trapeador hilaza No. 4
  '787696d5-ba15-58f9-9e02-d9b8f33c7a53'  -- Trapeador microseda bastón largo 300 Gr
);

UPDATE producto_base SET categoria = 'recogedores' WHERE id IN (
  'a33fbae3-d493-5e4f-93a0-521ff8e0612e', -- Recogedor media lata con baston delgado La Moderna
  'd402e2af-addf-5ff6-bc48-d64522845aad', -- Recogedor de Plastico La Moderna
  'b74a5b33-29de-55ab-b597-9a40ea801d87'  -- Recogedor galvanizado con baston La Moderna
);

UPDATE producto_base SET categoria = 'papel_institucional' WHERE id IN (
  '9a7d4349-e290-55d5-8079-93f06a3e5ef8', -- Toalla Interdoblada Blanca Sanilux 20/100
  '7ef258f2-6c96-5585-a120-ca3b49f968d3', -- Toalla Interdoblada Blanca Sanilux 20/200
  'a7fe11a0-ddc1-5758-9b75-0350eb069e9e', -- Toalla Interdoblada Natural Mocambo 20/200
  '02ba554d-76b4-522b-839f-3479166b48c1', -- Toalla Interdoblada Blanca Saniluxury 20/100
  '0957e80a-4db8-567f-906d-dc87a3999e31', -- Toalla en Rollo Blanca Gofrada Mocambo 6/180
  '072206e7-05f3-54cb-8fa1-0dbaa1bac3a3', -- Toalla en Rollo Natural Gofrada Mocambo 6/180
  '8d0b0644-d0af-54e1-a6d6-6692bae3bedf', -- Papel Higenico Jumbo Sanisol 6/400
  'c782e965-01b3-560d-8178-00be31d3f997', -- Papel Higenico Jr Sanisol 12/200
  '258ef52a-64aa-5854-b669-ac2135f51026'  -- Papel Higenico Jr Sanilux 12/250
);

UPDATE producto_base SET categoria = 'quimicos' WHERE id IN (
  '4d8ce2ae-cdb7-589a-9d9f-da6379639977', -- Limpiador Multiusos Canela Logiclean
  'c963f67d-7c2d-54cb-896e-8f30cc8fe11f', -- Limpiador Multiusos Mar Fresco Logiclean
  'fc943de9-8123-5b1f-a847-cb53873a79f8', -- Limpiador Multiusos Lavanda Logiclean
  '5c738381-d2f9-5637-8d26-603c858a9a88', -- Limpiador Multiusos Citrico Logiclean
  '87a77ab0-46e0-5f0c-b53f-e9366e20319f', -- Limpiador Multiusos Lima-Limon Logiclean
  'fd36dab8-4753-577b-b38a-34a9fd1efedb', -- Limpiador Multiusos Pinol Logiclean
  '5e18c4cc-a4c3-5c63-b765-e46f2dad4632', -- Lavatrastes Liquido Lima-Limon Logiclean
  '774d6cc5-ba57-5fd9-bc03-5260705eb663', -- Detergente Para Ropa Mas Color Logiclean
  '9674f154-eadb-5d7a-9b42-ccb95735aad2', -- Blanqueador Cloro Logiclean
  '4bcc0dfb-88f6-57de-a804-2c5ca404a622', -- Jabon para Manos Cereza Logiclean
  '4be73acc-524d-5ef6-88fa-07c00e12dc53'  -- Limpia Vidrios Logiclean
);

-- A partir de aquí, todo producto nuevo debe traer categoria (alta vía
-- ProductoForm exige el campo). El resto de la BD ya quedó categorizado arriba.
ALTER TABLE producto_base ALTER COLUMN categoria SET NOT NULL;
ALTER TABLE producto_base ADD CONSTRAINT producto_base_categoria_check
  CHECK (categoria IN ('escobas', 'trapeadores', 'recogedores', 'papel_institucional', 'quimicos'));

-- Alta: Desengrasante Logiclean (bidón, categoría quimicos), 3 presentaciones
INSERT INTO producto_base (id, nombre, unidad_compra, categoria, precio_preferencial, activo) VALUES
  ('0b54d937-fffc-58bd-b226-ae9cd3216e59', 'Desengrasante Logiclean', 'bidon', 'quimicos', NULL, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO presentacion (id, producto_base_id, nombre, unidad_venta, factor_conversion, precio_mayoreo, precio_menudeo, activo) VALUES
  ('c996425b-1eb4-5f24-9f8c-7d9892d6568a', '0b54d937-fffc-58bd-b226-ae9cd3216e59', 'Desengrasante 1 L Logiclean', 'litro', 1, 40.00, 40.00, true),
  ('3fc196b9-84ef-59fe-84e4-4674f5279708', '0b54d937-fffc-58bd-b226-ae9cd3216e59', 'Desengrasante 3.7 L Logiclean', 'litro', 3.7, 120.00, 120.00, true),
  ('fcb53c99-154f-5bfd-b3c3-8ea6da234c96', '0b54d937-fffc-58bd-b226-ae9cd3216e59', 'Desengrasante 20 L Logiclean', 'litro', 20, 600.00, 600.00, true)
ON CONFLICT (id) DO NOTHING;
