/** Capacitor Android parses application/json even when responseType is text. */
export function responseText(result:{status:number;url?:string;data:unknown},origin:string):string{
 if(result.status<200||result.status>=300)throw new Error('Movie information returned HTTP '+result.status+'.');
 if(result.url&&new URL(result.url).origin!==origin)throw new Error('Unexpected information destination.');
 const data=typeof result.data==='string'?result.data:origin==='https://en.wikipedia.org'&&result.data&&typeof result.data==='object'?JSON.stringify(result.data):null;
 if(typeof data!=='string'||new TextEncoder().encode(data).byteLength>3000000)throw new Error('Movie information could not be read.');
 return data;
}
