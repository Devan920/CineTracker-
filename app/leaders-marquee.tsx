'use client';
import { memo,useMemo } from 'react';
import { Trophy } from 'lucide-react';
import type { Movie,Report } from '../lib/boxoffice';
import { filmLeaders } from '../lib/leaders';

export default memo(function LeadersMarquee({movies,loading,status}:{movies:Movie[];loading:boolean;status?:Report['sourceStatus']}) {
 const groups=useMemo(()=>filmLeaders(movies),[movies]);
 const groupContent=groups.map(group=><span className="leader-item" key={group.id}>
  <span className="leader-region">{group.label}</span><span className="leader-separator">/</span>
  <strong>{loading?'Loading leaders…':group.movies.length?group.movies.map(movie=>movie.title).join(' & '):'Awaiting a comparable gross report'}</strong>
  {group.gross!==null&&<><span className="leader-gross">₹{group.gross.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} Cr</span><span className="leader-measure">worldwide{group.movies.length>1?' · joint leaders':''}</span></>}
  <span className="leader-diamond" aria-hidden="true">✦</span>
 </span>);
 return <section className="leaders-marquee" aria-label="Leading South and North Indian films">
  <div className="leaders-caption"><span><Trophy size={14}/>{status==='error'||status==='partial'?'LAST AVAILABLE LEADERS':status==='initial'?'COLLECTION SNAPSHOT':'BOX OFFICE LEADERS'}</span></div>
  <div className="marquee-window" tabIndex={0} aria-label="Film leaders; focus to read at your own pace"><div className="marquee-track"><div className="marquee-group">{groupContent}</div><div className="marquee-group marquee-copy" aria-hidden="true">{groupContent}</div></div></div>
  <p className="leaders-context">Highest reported worldwide gross among tracked films, grouped by film industry. Regional theatre totals unavailable.</p>
 </section>;
});
