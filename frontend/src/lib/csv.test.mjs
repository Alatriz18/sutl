// Pruebas del lector de CSV y de la normalización de números y fechas.
// Ejecutar: npm run test:unit (usa el ejecutor de pruebas integrado de Node).
import test from 'node:test';
import assert from 'node:assert/strict';
import { celdaATexto, normalizarFecha, normalizarNumero, parseCsv, tablaDesdeHoja } from './csv.ts';

test('detecta el delimitador: punto y coma (Excel en español), coma, tabulador y barra', () => {
  assert.equal(parseCsv('a;b;c\n1;2;3').delimitador, ';');
  assert.equal(parseCsv('a,b,c\n1,2,3').delimitador, ',');
  assert.equal(parseCsv('a\tb\tc\n1\t2\t3').delimitador, '\t');
  assert.equal(parseCsv('a|b|c\n1|2|3').delimitador, '|');
  assert.deepEqual(parseCsv('a;b;c\n1;2;3').filas, [['1', '2', '3']]);
});

test('no cuenta los delimitadores que están dentro de comillas', () => {
  const r = parseCsv('"Nombre, completo";edad\n"Pérez, Juan";30');
  assert.equal(r.delimitador, ';');
  assert.deepEqual(r.encabezados, ['Nombre, completo', 'edad']);
  assert.deepEqual(r.filas, [['Pérez, Juan', '30']]);
});

test('maneja comillas escapadas, saltos de línea dentro de una celda, BOM y CRLF', () => {
  const r = parseCsv('﻿a,b\r\n"dice ""hola""","línea 1\nlínea 2"\r\nx,y\r\n');
  assert.deepEqual(r.encabezados, ['a', 'b']);
  assert.deepEqual(r.filas, [
    ['dice "hola"', 'línea 1\nlínea 2'],
    ['x', 'y'],
  ]);
});

test('ignora líneas vacías y reporta el número de línea real del archivo', () => {
  const r = parseCsv('a,b\n1,2\n\n3,4\n"x\ny",5\n6,7');
  assert.deepEqual(r.lineas, [2, 4, 5, 7]);
});

test('encabezados vacíos o repetidos se vuelven únicos y las filas cortas se completan', () => {
  const r = parseCsv('sku,,sku,cant\nA,1');
  assert.deepEqual(r.encabezados, ['sku', 'Columna 2', 'sku (2)', 'cant']);
  assert.deepEqual(r.filas, [['A', '1', '', '']]);
});

test('un archivo vacío no revienta', () => {
  assert.deepEqual(parseCsv('').filas, []);
  assert.deepEqual(parseCsv('   \n\n').encabezados, []);
});

test('normalizarNumero entiende los formatos de la región y de EE. UU.', () => {
  const casos = [
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1234,5', 1234.5],
    ['$ 12,50', 12.5],
    ['1.234', 1234], // tres dígitos tras el separador: miles
    ['1,5', 1.5],
    ['0.500', 0.5],
    ['12.5', 12.5],
    ['-3,5', -3.5],
    ['1.234.567', 1234567],
    ['100', 100],
    ['  42  ', 42],
  ];
  for (const [entrada, esperado] of casos) assert.equal(normalizarNumero(entrada), esperado, `«${entrada}»`);
});

test('normalizarNumero devuelve null cuando no es un número', () => {
  for (const x of ['', 'abc', '--', '.', 'N/A']) assert.equal(normalizarNumero(x), null, `«${x}»`);
});

test('normalizarFecha acepta ISO, día/mes/año, año de 2 dígitos y números de serie de Excel', () => {
  assert.equal(normalizarFecha('2026-12-15'), '2026-12-15');
  assert.equal(normalizarFecha('2026/1/5'), '2026-01-05');
  assert.equal(normalizarFecha('15/12/2026'), '2026-12-15');
  assert.equal(normalizarFecha('5-1-26'), '2026-01-05');
  assert.equal(normalizarFecha('15.12.2026'), '2026-12-15');
  assert.equal(normalizarFecha('2026-12-15T10:00:00Z'), '2026-12-15');
  assert.equal(normalizarFecha('45658'), '2025-01-01');
});

test('normalizarFecha rechaza fechas que no existen y textos', () => {
  for (const x of ['31/02/2026', '2026-13-01', '00/01/2026', 'mañana', '', '123']) {
    assert.equal(normalizarFecha(x), null, `«${x}»`);
  }
});

test('celdas de Excel: los números reales no se reinterpretan como miles', () => {
  assert.equal(normalizarNumero(celdaATexto(1.234)), 1.234);
  assert.equal(normalizarNumero(celdaATexto(0.125)), 0.125);
  assert.equal(normalizarNumero(celdaATexto(1234.567)), 1234.567);
  assert.equal(normalizarNumero(celdaATexto(1234)), 1234);
  assert.equal(normalizarNumero(celdaATexto(-2.5)), -2.5);
  assert.equal(normalizarNumero(celdaATexto(1e-7)), 0.0000001);
  assert.equal(celdaATexto(Number.NaN), '');
});

test('celdas de Excel: fechas, textos, vacíos y booleanos', () => {
  assert.equal(celdaATexto(new Date(Date.UTC(2026, 10, 9))), '2026-11-09');
  assert.equal(normalizarFecha(celdaATexto(new Date(Date.UTC(2026, 10, 9)))), '2026-11-09');
  assert.equal(celdaATexto(new Date('x')), '');
  assert.equal(celdaATexto('  hola '), 'hola');
  assert.equal(celdaATexto(null), '');
  assert.equal(celdaATexto(undefined), '');
  assert.equal(celdaATexto(true), 'Sí');
});

test('hoja de Excel: encabezados únicos, filas vacías descartadas y línea real de la hoja', () => {
  const t = tablaDesdeHoja([
    ['SKU', 'SKU', null, 'Cantidad'],
    ['A-1', 'x', null, 10],
    [null, null, null, null],
    ['A-2', 'y', null, 1.5],
  ]);
  assert.deepEqual(t.encabezados, ['SKU', 'SKU (2)', 'Columna 3', 'Cantidad']);
  assert.deepEqual(t.filas, [['A-1', 'x', '', '10'], ['A-2', 'y', '', '1.5']]);
  assert.deepEqual(t.lineas, [2, 4]);
  assert.deepEqual(tablaDesdeHoja([]).filas, []);
});

