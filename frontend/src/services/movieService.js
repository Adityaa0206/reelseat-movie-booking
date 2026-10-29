import {MOCK_MOVIES,MOCK_CINEMAS} from '../data/mockData.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// TODO(backend): GET /movies, GET /movies/:id, GET /movies/:id/shows?date=YYYY-MM-DD  (all below are MOCK)
export async function getMovies(){await wait(300);return MOCK_MOVIES;}
export async function getMovie(id){await wait(200);const m=MOCK_MOVIES.find(x=>x.id===id);if(!m)throw new Error('Movie not found.');return m;}
export async function getShows(movieId,date){await wait(200);return MOCK_CINEMAS.map(c=>({cinema:c,shows:c.times.map(t=>({id:`${movieId}_${c.id}_${date}_${t}`,time:t}))}));}
// MOCK seat layout. TODO(backend): GET /shows/:showId/seats -> [{id,row,number,category,price,status:'available'|'held'|'booked'}]
// Existing GET /events/:eventId/seats can be mapped here once its response shape is confirmed.
export async function getSeats(showId){await wait(300);const out=[];[...'ABCDEFGH'].forEach((r,ri)=>{for(let n=1;n<=12;n++){const h=(showId.length*7+ri*13+n*17)%11;
  out.push({id:`${r}${n}`,row:r,number:n,category:ri<2?'Premium':'Standard',price:ri<2?350:250,status:h===0||h===2?'booked':h===1&&ri>3?'held':'available'});}});return out;}
