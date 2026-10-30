import type {Movie} from './boxoffice';

export type MovieMatch = {pageId:number; title:string; year:number|null; description:string};
export type FilmDetails = {
  title:string; year:number|null; cast:string[]; director:string|null; story:string|null;
  sourceUrl:string|null; checkedAt:string; stale?:boolean; choices?:MovieMatch[]; message?:string;
};
export type ArchiveReport = {movies:Movie[]; checkedAt:string|null; stale:boolean; error?:string};
