import {validate} from './lib/validation.mjs';
import {SUPABASE_URL,SUPABASE_KEY} from './config.mjs';
const form=document.querySelector('#request-form'),fields=document.querySelector('#fields'),send=document.querySelector('#send'),status=document.querySelector('#status');
const model=form.elements.namedItem('model'),photo=document.querySelector('#vehicle-photo'),caption=document.querySelector('#vehicle-caption'),placeholder=document.querySelector('#vehicle-placeholder');
const vehicles={'UMO 5':'images/umo-5.webp','UMO 8':'images/umo-8.webp'};
function updateVehicle(){const src=vehicles[model.value];photo.hidden=!src;placeholder.hidden=!!src;caption.textContent=src?model.value:'Ваш будущий UMO';if(src){photo.src=src;photo.alt='Автомобиль '+model.value;}else{photo.removeAttribute('src');photo.alt='';}}
model.addEventListener('change',updateVehicle);model.addEventListener('input',updateVehicle);form.addEventListener('reset',()=>setTimeout(updateVehicle,0));updateVehicle();
let attempt='',payload='',busy=false;
send.disabled=false;send.textContent='Отправить заявку';
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;status.hidden=true;
 const values=Object.fromEntries(new FormData(form));const result=validate(values);
 for(const name of ['name','phone','inn','model','quantity']){const input=form.elements.namedItem(name),error=document.getElementById(name+'-error');input.setAttribute('aria-invalid',String(!!result.errors[name]));error.textContent=result.errors[name]??'';error.hidden=!result.errors[name];if(result.errors[name])input.setAttribute('aria-describedby',name+'-error');else input.removeAttribute('aria-describedby');}
 if(!result.ok){form.elements.namedItem(Object.keys(result.errors)[0]).focus();return;}
 const serialized=JSON.stringify(result.data);if(payload!==serialized||!attempt){payload=serialized;attempt=crypto.randomUUID();}
 busy=true;fields.disabled=true;send.textContent='Сохраняем заявку…';
 try{
 const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/submit_exhibition_request',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_id:attempt,p_phone:result.data.phone,p_name:result.data.name,p_inn:result.data.inn,p_model:result.data.model,p_quantity:result.data.quantity,p_website:values.website??''})});
 const body=await r.json();if(!r.ok||body?.ok!==true){const code=body?.message??'';throw Error(code.includes('rate_limit')?'Слишком много отправок. Попробуйте позже или обратитесь к нам на стенде.':code.includes('validation')?'Проверьте данные в форме.':'Не удалось сохранить заявку. Попробуйте ещё раз или обратитесь к нам на стенде.');}
 form.reset();document.querySelector('#entry').hidden=true;document.querySelector('#success').hidden=false;document.querySelector('#success-title').focus();
 }catch(error){status.textContent=error instanceof TypeError?'Нет связи с сервером. Проверьте подключение и повторите отправку.':error.message;status.hidden=false;}finally{busy=false;fields.disabled=false;send.textContent='Отправить заявку';}
});
document.querySelector('#again').addEventListener('click',()=>{attempt='';payload='';document.querySelector('#success').hidden=true;document.querySelector('#entry').hidden=false;form.elements.namedItem('name').focus();});
