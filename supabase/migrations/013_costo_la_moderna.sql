-- ============================================================
-- Logiclean Ruta — Migración 013: costo La Moderna por producto
--
-- Carga precio_preferencial (costo unitario que La Moderna cobra a Logiclean,
-- ADR-0009) desde la lista de costos entregada por el cliente
-- (Logiclean_costos_La_Moderna.xlsx). Hasta esta migración, las 35 filas
-- activas de producto_base tenían precio_preferencial = NULL, así que el
-- corte por reparto venía calculando el adeudo a La Moderna
-- ((recibido − devuelto) × precio_preferencial, ver docs/modelo-datos-logiclean.md)
-- como $0 para todo producto — el código hace `?? 0` ante NULL
-- (src/lib/suministro.ts, src/pages/admin/corteReparto/useCorteReparto.ts).
--
-- 3 valores del Excel venían en decimal periódico (arrastre de dividir entre
-- 12 antes de la migración 012, cuando estos productos se compraban por
-- docena): se redondean a 2 decimales, la precisión de la columna
-- (DECIMAL(12,2)). Idempotente (UPDATE por id).
-- ============================================================

-- Escobas
UPDATE producto_base SET precio_preferencial = 47.50 WHERE id = 'befa967a-b254-5627-8be2-d0dc131e7f52'; -- Escoba mixta 6 hilos La Moderna
UPDATE producto_base SET precio_preferencial = 62.50 WHERE id = 'ac53244a-c78d-5c17-9c85-8b7e9d3260e6'; -- Escoba de mijo 6 hilos La Moderna
UPDATE producto_base SET precio_preferencial = 90.00 WHERE id = 'c57079f7-239c-5a10-9a50-a574cad92197'; -- Escoba industrial con aro 8 hilos La Moderna
UPDATE producto_base SET precio_preferencial = 44.17 WHERE id = 'e7e3e8c1-0d68-57cd-94e1-7e08d5647340'; -- Escoba de popotillo de coco roja La Moderna (redondeado de 44.1666...)
UPDATE producto_base SET precio_preferencial = 52.50 WHERE id = 'd9a57e67-cff6-5e93-b7aa-840c67182c92'; -- Escoba de popotillo de coco gris La Moderna
UPDATE producto_base SET precio_preferencial = 61.67 WHERE id = '5b2dc1bd-2308-5290-8635-c137f88b3e75'; -- Escoba de plástico 7 hilos La Moderna (redondeado de 61.6666...)
UPDATE producto_base SET precio_preferencial = 40.00 WHERE id = 'f5aae65c-e82f-5028-899a-d2dcba7b19f4'; -- Escoba de abanico larga
UPDATE producto_base SET precio_preferencial = 40.00 WHERE id = 'e9b754cd-121d-5e1b-b916-e755f3a5e0a5'; -- Escoba de abanico corta

-- Trapeadores
UPDATE producto_base SET precio_preferencial = 36.67 WHERE id = 'cc183a49-b182-54de-924c-1e4fae2dcbf5'; -- Trapeador rayón No. 4 (redondeado de 36.6666...)
UPDATE producto_base SET precio_preferencial = 41.08 WHERE id = '67a2e7d5-152c-5d6b-9340-46e5b3bd4dfb'; -- Trapeador hilaza No. 4 (redondeado de 41.0833...)
UPDATE producto_base SET precio_preferencial = 75.00 WHERE id = '787696d5-ba15-58f9-9e02-d9b8f33c7a53'; -- Trapeador microseda bastón largo 300 Gr

-- Recogedores
UPDATE producto_base SET precio_preferencial = 35.00 WHERE id = 'a33fbae3-d493-5e4f-93a0-521ff8e0612e'; -- Recogedor media lata con bastón delgado La Moderna
UPDATE producto_base SET precio_preferencial = 50.00 WHERE id = 'd402e2af-addf-5ff6-bc48-d64522845aad'; -- Recogedor de Plástico La Moderna
UPDATE producto_base SET precio_preferencial = 80.00 WHERE id = 'b74a5b33-29de-55ab-b597-9a40ea801d87'; -- Recogedor galvanizado con bastón La Moderna

-- Químicos (costo del bidón de 20 L que envasa Logiclean)
UPDATE producto_base SET precio_preferencial = 225.00 WHERE id = '4d8ce2ae-cdb7-589a-9d9f-da6379639977'; -- Limpiador Multiusos Canela Logiclean
UPDATE producto_base SET precio_preferencial = 225.00 WHERE id = 'c963f67d-7c2d-54cb-896e-8f30cc8fe11f'; -- Limpiador Multiusos Mar Fresco Logiclean
UPDATE producto_base SET precio_preferencial = 225.00 WHERE id = 'fc943de9-8123-5b1f-a847-cb53873a79f8'; -- Limpiador Multiusos Lavanda Logiclean
UPDATE producto_base SET precio_preferencial = 225.00 WHERE id = '5c738381-d2f9-5637-8d26-603c858a9a88'; -- Limpiador Multiusos Cítrico Logiclean
UPDATE producto_base SET precio_preferencial = 225.00 WHERE id = '87a77ab0-46e0-5f0c-b53f-e9366e20319f'; -- Limpiador Multiusos Lima-Limón Logiclean
UPDATE producto_base SET precio_preferencial = 178.00 WHERE id = 'fd36dab8-4753-577b-b38a-34a9fd1efedb'; -- Limpiador Multiusos Pinol Logiclean
UPDATE producto_base SET precio_preferencial = 370.00 WHERE id = '5e18c4cc-a4c3-5c63-b765-e46f2dad4632'; -- Lavatrastes Líquido Lima-Limón Logiclean
UPDATE producto_base SET precio_preferencial = 340.00 WHERE id = '774d6cc5-ba57-5fd9-bc03-5260705eb663'; -- Detergente Para Ropa Mas Color Logiclean
UPDATE producto_base SET precio_preferencial = 170.00 WHERE id = '9674f154-eadb-5d7a-9b42-ccb95735aad2'; -- Blanqueador Cloro Logiclean
UPDATE producto_base SET precio_preferencial = 340.00 WHERE id = '4bcc0dfb-88f6-57de-a804-2c5ca404a622'; -- Jabón para Manos Cereza Logiclean
UPDATE producto_base SET precio_preferencial = 200.00 WHERE id = '4be73acc-524d-5ef6-88fa-07c00e12dc53'; -- Limpia Vidrios Logiclean
UPDATE producto_base SET precio_preferencial = 220.00 WHERE id = '0b54d937-fffc-58bd-b226-ae9cd3216e59'; -- Desengrasante Logiclean

-- Papel institucional (costo por caja)
UPDATE producto_base SET precio_preferencial = 195.75 WHERE id = '9a7d4349-e290-55d5-8079-93f06a3e5ef8'; -- Toalla Interdoblada Blanca Sanilux 20/100
UPDATE producto_base SET precio_preferencial = 474.15 WHERE id = '7ef258f2-6c96-5585-a120-ca3b49f968d3'; -- Toalla Interdoblada Blanca Sanilux 20/200
UPDATE producto_base SET precio_preferencial = 339.30 WHERE id = 'a7fe11a0-ddc1-5758-9b75-0350eb069e9e'; -- Toalla Interdoblada Natural Mocambo 20/200
UPDATE producto_base SET precio_preferencial = 204.45 WHERE id = '02ba554d-76b4-522b-839f-3479166b48c1'; -- Toalla Interdoblada Blanca Saniluxury 20/100
UPDATE producto_base SET precio_preferencial = 361.05 WHERE id = '0957e80a-4db8-567f-906d-dc87a3999e31'; -- Toalla en Rollo Blanca Gofrada Mocambo 6/180
UPDATE producto_base SET precio_preferencial = 295.80 WHERE id = '072206e7-05f3-54cb-8fa1-0dbaa1bac3a3'; -- Toalla en Rollo Natural Gofrada Mocambo 6/180
UPDATE producto_base SET precio_preferencial = 321.90 WHERE id = '8d0b0644-d0af-54e1-a6d6-6692bae3bedf'; -- Papel Higiénico Jumbo Sanisol 6/400
UPDATE producto_base SET precio_preferencial = 321.90 WHERE id = 'c782e965-01b3-560d-8178-00be31d3f997'; -- Papel Higiénico Jr Sanisol 12/200
UPDATE producto_base SET precio_preferencial = 513.30 WHERE id = '258ef52a-64aa-5854-b669-ac2135f51026'; -- Papel Higiénico Jr Sanilux 12/250
