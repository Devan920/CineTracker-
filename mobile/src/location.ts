import {approximateLocation,type AreaChoice} from '../../lib/theatres.ts';
type LocationPlugin={checkPermissions:()=>Promise<{coarseLocation:string}>;requestPermissions:(options:{permissions:['coarseLocation']})=>Promise<{coarseLocation:string}>;getCurrentPosition:(options:{enableHighAccuracy:boolean;timeout:number;maximumAge:number})=>Promise<{coords:{latitude:number;longitude:number;accuracy:number}}>};
export async function requestApproximateLocation(plugin:LocationPlugin):Promise<AreaChoice>{
 let permissions;
 try{permissions=await plugin.checkPermissions();}catch{throw Error('Turn on device Location, or choose a town instead.');}
 if(permissions.coarseLocation!=='granted')permissions=await plugin.requestPermissions({permissions:['coarseLocation']});
 if(permissions.coarseLocation!=='granted')throw Error('Location permission was not granted. Choose a town, or allow location in Android app settings.');
 try{return approximateLocation((await plugin.getCurrentPosition({enableHighAccuracy:false,timeout:15000,maximumAge:60000})).coords);}
 catch{throw Error('Could not get your location. Check device Location settings, or choose a town.');}
}
