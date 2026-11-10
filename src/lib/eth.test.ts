// Rodar com: pnpm test:unit (Playwright, projeto "unit", sem navegador)
import { expect, test } from '@playwright/test'
import { compareEth, fromWei, mulEth, percentOf, subEth, sumEth, toWei } from './eth'

test('soma sem erro de ponto flutuante', () => {
  expect(sumEth(['0.1', '0.2'])).toBe('0.30')
  expect(sumEth(['2.38', '8.34', '16.11'])).toBe('26.83')
  expect(sumEth(['26.83', '0.016'])).toBe('26.846')
})

test('multiplica por quantidade inteira', () => {
  expect(mulEth('1.19', 2)).toBe('2.38')
  expect(mulEth('1.79', 9)).toBe('16.11')
  expect(() => mulEth('1', 1.5)).toThrow()
})

test('percentual, subtração e comparação', () => {
  expect(percentOf('26.83', 10)).toBe('2.683')
  expect(subEth('1', '2')).toBe('0.00')
  expect(compareEth('1.10', '1.1')).toBe(0)
  expect(compareEth('0.99', '1')).toBe(-1)
})

test('ida e volta preserva 18 casas', () => {
  expect(fromWei(toWei('0.000000000000000001'))).toBe('0.000000000000000001')
  expect(() => toWei('1e3')).toThrow()
  expect(() => toWei('-1')).toThrow()
})
