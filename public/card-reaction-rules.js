/* Shared, fixed vocabulary. Reactions never contain user-supplied markup. */
(function(){
 const quick=[
  {id:'like',emoji:'👍',label:'打得好',tone:'positive'},
  {id:'clap',emoji:'👏',label:'精彩精彩',tone:'positive'},
  {id:'laugh',emoji:'😂',label:'笑出声',tone:'tease'},
  {id:'smirk',emoji:'😏',label:'就这？',tone:'tease'},
  {id:'angry',emoji:'😤',label:'不服气',tone:'upset'},
  {id:'cry',emoji:'😭',label:'太难了',tone:'sad'}
 ];
 const replies=[{id:'think',emoji:'🤔',label:'让我想想'},{id:'eyeroll',emoji:'🙄',label:'听出来了'},
  {id:'cool',emoji:'😎',label:'稳住'},{id:'handshake',emoji:'🤝',label:'好队友'},
  {id:'sweat',emoji:'😅',label:'有点尴尬'}];
 globalThis.AVEDCardReactionRules=Object.freeze({quick:Object.freeze(quick.map(Object.freeze)),items:Object.freeze([...quick,...replies].map(Object.freeze)),lifetime:4400});
})();
