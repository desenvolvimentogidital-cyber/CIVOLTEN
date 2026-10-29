import test from 'node:test';
import assert from 'node:assert/strict';
import {computeBudget,calculatePlan} from '../src/calc.mjs';
test('custo unitário, BDI e horas-homem',()=>{
 const res=computeBudget([{qty:100,unit_cost:35.5,hh_unit:0.8}],{bdi:25});
 assert.equal(res.cost,3550);assert.equal(res.bdiValue,887.5);assert.equal(res.total,4437.5);assert.equal(res.laborHours,80);
});
test('capacidade, eficiência e folga',()=>{
 const p=calculatePlan([{description:'Alvenaria',qty:100,unit_cost:30,hh_unit:.8}],{workers:2,hours_day:8,efficiency:.8,safety_pct:20,work_days_week:5,start_date:'2026-11-02'});
 assert.equal(p.baseDays,7);assert.equal(p.safetyDays,2);assert.equal(p.totalDays,9);assert.equal(p.finish,'2026-11-12');
});
test('sem valores negativos para atividades',()=>{
 const a=computeBudget([{qty:-3,unit_cost:-2,hh_unit:-1}],{bdi:0});assert.equal(a.total,0);assert.equal(a.laborHours,0);
});