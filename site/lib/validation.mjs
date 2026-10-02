export function validInn(s) {
 if (!/^\d{10}(\d{2})?$/.test(s) || /^0+$/.test(s)) return false;
 const digit = w => w.reduce((sum,n,i)=>sum+n*Number(s[i]),0)%11%10;
 return s.length===10 ? digit([2,4,10,3,5,9,4,6,8])===Number(s[9]) : digit([7,2,4,10,3,5,9,4,6,8])===Number(s[10]) && digit([3,7,2,4,10,3,5,9,4,6,8])===Number(s[11]);
}
export function validate(input) {
 const v = input && typeof input==='object' ? input : {};
 const text = key => typeof v[key]==='string' ? v[key].trim() : '';
 const data = {phone:text('phone'),name:text('name'),inn:text('inn'),model:text('model'),quantity:0};
 /** @type {Record<string,string>} */
 const errors = {};
 let digits = data.phone.replace(/[\s()+-]/g,'');
 if(digits.length===11 && digits[0]==='8') digits='7'+digits.slice(1);
 if(!/^[1-9]\d{9,14}$/.test(digits)) errors.phone='Введите телефон с кодом страны, от 10 до 15 цифр.';
 data.phone='+'+digits;
 if(data.name.length<2 || data.name.length>100 || /[\x00-\x1f<>]/.test(data.name)) errors.name='Введите имя: от 2 до 100 символов.';
 if(!validInn(data.inn)) errors.inn='Проверьте ИНН: 10 или 12 цифр и корректное контрольное число.';
 if(data.model.length<1 || data.model.length>150 || /[\x00-\x1f<>]/.test(data.model)) errors.model='Укажите модель: не более 150 символов.';
 const q=String(v.quantity??'');
 if(!/^\d{1,6}$/.test(q) || Number(q)<1 || Number(q)>100000) errors.quantity='Введите целое число от 1 до 100 000.';
 data.quantity=Number(q);
 return {data,errors,ok:Object.keys(errors).length===0};
}

