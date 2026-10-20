import type { Metadata,Viewport } from 'next';
import { themeBootstrap } from '../lib/appearance';
import './globals.css';
import './mobile.css';
import './redesign.css';
export const metadata:Metadata={title:'CineTracker — Box office, clearly',description:'Indian box-office collection reports. Explore collections, daily trends, and the latest published estimates.',applicationName:'CineTracker',icons:{icon:'/favicon.svg',apple:[{url:'/icons/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]},appleWebApp:{capable:true,title:'CineTracker',statusBarStyle:'black-translucent'},formatDetection:{telephone:false}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',colorScheme:'light dark'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="theme-color" content="#f8f9f6"/><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head><body>{children}</body></html>;}
