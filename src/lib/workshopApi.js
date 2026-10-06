import {auth} from '../firebase';
const ROOT='https://us-central1-tyremen-system.cloudfunctions.net';
export async function workshopPost(path,body,signal){
  if(!auth.currentUser)throw new Error('Please sign in again');
  const token=await auth.currentUser.getIdToken();
  const response=await fetch(`${ROOT}/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),signal});
  const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||'Workshop request failed');return data;
}
