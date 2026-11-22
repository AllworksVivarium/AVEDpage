import test from 'node:test';
import assert from 'node:assert/strict';
import names from '../public/personnel-name.js';
import parser from '../public/employee-import.js';

test('English real names capitalize the first letter while retaining spelling and mixed-language names',()=>{
 for(const [input,expected] of [['alice','Alice'],[' john mCkay ','John mCkay'],["o'connor","O'connor"],['mary-jane','Mary-jane'],['j. smith','J. smith'],['d’artagnan','D’artagnan'],['AVED','AVED'],['John','John'],['alice张','alice张'],['张 alice','张 alice'],['object-07','object-07'],['','']])assert.equal(names.normalizeRealName(input),expected);
 assert.equal(names.normalizeRealName(null),null);
});

test('bulk registration normalizes preview and duplicate names while attribute matching preserves login case',()=>{
 const result=parser.parse('姓名,用户名,部门\nalice,Alice,后勤部');assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].name,'Alice');
 assert.match(parser.parse('alice\nAlice').errors[0].message,/重复/);
 const update=parser.parse('alice 60 50 40 30 20 10','attributes');assert.deepEqual(update.errors,[]);assert.equal(update.rows[0].name,'alice');
});
