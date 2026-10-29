// MOCK DATA (development only). Replace via services/movieService.js when backend endpoints exist.
const g=c=>`linear-gradient(160deg,${c},#1a1a1d)`;
export const MOCK_MOVIES=[
{id:'1',title:'Midnight Harbour',language:'English',genres:['Thriller','Drama'],rating:8.4,duration:'2h 14m',status:'now',color:'#7a1e1e',synopsis:"A dock inspector uncovers a smuggling ring operating under the city's oldest port authority.",cast:['A. Rowe','M. Silva','K. Tan']},
{id:'2',title:'Paper Monsoon',language:'Hindi',genres:['Romance','Drama'],rating:7.9,duration:'2h 31m',status:'now',color:'#274b6d',synopsis:'Two letter-writers in Mumbai fall for each other without ever meeting.',cast:['R. Kapoor','N. Iyer']},
{id:'3',title:'Iron Orchard',language:'Telugu',genres:['Action'],rating:8.1,duration:'2h 45m',status:'now',color:'#5b3a1a',synopsis:'A retired soldier defends his village from land grabbers.',cast:['V. Reddy','S. Rao']},
{id:'4',title:'The Last Cartographer',language:'English',genres:['Adventure','Fantasy'],rating:7.6,duration:'2h 05m',status:'now',color:'#2c5a46',synopsis:'A mapmaker follows a chart that redraws itself.',cast:['E. Hale','J. Park']},
{id:'5',title:'Static',language:'Tamil',genres:['Sci-Fi','Thriller'],rating:0,duration:'1h 58m',status:'soon',releaseDate:'Nov 14',color:'#4a2a63',synopsis:'A radio operator hears broadcasts from tomorrow.',cast:['D. Kumar']},
{id:'6',title:'Saffron Road',language:'Hindi',genres:['Comedy'],rating:0,duration:'2h 10m',status:'soon',releaseDate:'Nov 28',color:'#8a5a12',synopsis:'A food-truck road trip across Rajasthan goes wrong, deliciously.',cast:['P. Shah']}].map(m=>({...m,poster:g(m.color),trailer:'https://www.youtube.com/'}));
export const MOCK_CINEMAS=[{id:'c1',name:'PVR Kadapa Central',times:['10:30','13:45','17:15','21:00']},{id:'c2',name:'Sri Venkateswara Cinemas',times:['11:00','14:30','18:00','21:30']}];
export const CITIES=['Kadapa','Hyderabad','Bengaluru','Chennai','Mumbai'];
