// 种子数据：Node fetch 原生 UTF-8，避免 Windows 控制台 GBK 乱码
import { readFileSync } from 'node:fs';

const B = 'http://localhost:4000/api';

async function upload(path, name) {
  const buf = readFileSync(path);
  const fd = new FormData();
  fd.append('file', new Blob([buf]), name);
  const res = await fetch(`${B}/upload`, { method: 'POST', body: fd });
  return res.json();
}

const post = (path, body) => fetch(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

const [s1, s2, s3, font] = await Promise.all([
  upload('C:/Users/June_Qiu/AppData/Local/Temp/seed1.png', '贴纸-粉发少女.png').catch(() => null),
  upload('C:/Users/June_Qiu/AppData/Local/Temp/seed2.png', '贴纸-黑白插画.png').catch(() => null),
  upload('C:/Users/June_Qiu/AppData/Local/Temp/seed3.png', '模板-猫咪.png').catch(() => null),
  upload('C:/Windows/Fonts/simfang.ttf', '仿宋.ttf').catch(() => null),
]);
console.log('uploads:', [s1, s2, s3, font].map((r) => (r ? r.url : 'FAIL')).join(' '));

const cat1 = await post('/cats', { label: '贴纸' });
const cat2 = await post('/cats', { label: '涂鸦' });
console.log('cats:', cat1.id, cat2.id);

console.log(await post('/assets', { name: '贴纸-粉发少女', url: s1.url, cat: cat1.id }));
await post('/assets', { name: '贴纸-黑白插画', url: s2.url, cat: cat1.id });
await post('/assets', { name: '涂鸦示例', url: s3.url, cat: cat2.id });

const v = await post('/vars', { label: '四季' });
console.log('var:', v.id);
console.log(await post('/templates', { name: '猫咪', preview: s3.url, photo: s1.url, var: v.id }));
console.log(await post('/fonts', { name: '仿宋', url: font.url }));
console.log('done');
