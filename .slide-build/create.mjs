import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { finalizePresentation } from '/home/aradhana/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root = process.cwd(), skill='/home/aradhana/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations';
const p=Presentation.create({slideSize:{width:1518,height:870}}), s=p.slides.add();
s.background.fill='#F1FCDF';
function box(x,y,w,h,fill,line='#166340',geo='roundRect') {return s.shapes.add({geometry:geo,position:{left:x,top:y,width:w,height:h},fill,line:{fill:line,width:2,style:'solid'}})}
function text(t,x,y,w,h,size=26,color='#173D30',bold=false,align='left') {const b=box(x,y,w,h,'none','none','textbox');b.text=t;b.text.style={typeface:'Lato',fontSize:size,color,bold,alignment:align};return b;}
text('Validation, Error Handling & Retry',72,63,1240,66,46,'#0B5C39',true);
text('ClinSync checks access and workflow state before each action',74,137,1250,40,27,'#193A2B',true);
const stages=['Ordered','Received','Sample collected','Processing','Awaiting verification','Completed'];
const xs=[72,306,540,774,1008,1242];
for(let i=0;i<6;i++) {box(xs[i],228,204,63,i===5?'#0C613B':'#E0F1E6');text(stages[i],xs[i]+9,i===4?228:239,186,i===2||i===4?63:46,i===2||i===4?22:25,i===5?'#FFFFFF':'#173D30',true,'center');if(i<5) box(xs[i]+206,258,26,2,'#166340','#166340','rect');}
text('Technician assignment marks receipt by LIS',74,301,680,28,20,'#43614F');
box(72,365,646,420,'#E0F1EE','#26918A');
text('Validation checks',98,385,590,52,36,'#153E30');
const checks=[['Patient and visit','Valid patient record and an active visit for orders'],['Staff access','Assigned doctor, technician and reviewer permissions'],['Test selection','Valid catalogue tests and no repeated selections'],['Workflow state','Collection, processing and review in the correct order'],['Duplicate protection','Blocks duplicate samples and analyser runs'],['Required information','Reasons for rejection, hold, rerun and cancellation']];
checks.forEach(([a,b],i)=>{let y=450+i*52;text(a,100,y,585,26,24,'#173D30',true);text(b,100,y+26,585,27,21,'#345547');});
box(760,365,686,173,'#D4E8CB','#997552');
text('Cancelled: before analysis starts',786,385,632,40,31,'#173D30',true);
text('The ordering doctor records a reason, including when a\nsample will not be recollected. Cancellation blocks further\nlab actions and keeps the order in the patient record.',786,439,632,81,23);
box(760,550,686,235,'#D4E8CB','#997552');
text('Exception handling',786,570,630,42,34,'#173D30');
const ex=['Rejected sample: record reason and collect again', 'Held result: pathologist records a reason for review', 'Rerun: repeat analysis and preserve earlier runs', 'API failure: show an error so staff can retry'];
ex.forEach((t,i)=>text(t,788,626+i*33,630,32,23));
text('Audit records capture key lab actions and cancellation reasons. Pathologist approval releases reports.',74,810,1370,33,21,'#43614F');
s.speakerNotes.text='Based on ClinSync implementation: backend/routers/doctor.py (patient scope, order validation, cancellation); backend/routers/technician.py (assigned technician, sample state, duplicate sample/run checks, rejection and rerun); backend/routers/pathologist.py (review access, reasons, release); backend/lab_workflow.py (six displayed stages); frontend/src/api/client.ts (API errors). Received means technician assignment in the current application. Cancellation is permitted for Ordered/Assigned orders with no analysis results or released reports and no sample processing. Rejection does not automatically cancel. Key successful actions have audit records; the application does not provide a general integration failure log or message resend console. The analyser is simulated in the current implementation. The source was a screenshot; text and workflow were recreated as editable slide elements.';
await fs.writeFile(path.join(root,'.slide-build/preview.png'), new Uint8Array(await (await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
const candidate=path.join(root,'.slide-build/candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(root,'outputs/ClinSync-validation-slide.pptx'),pythonExecutable:'/home/aradhana/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','14458950,8286750','--validate-heading-fit'],explicitTotalSlideCount:1,fontPolicy:{basis:'design',families:['Lato']},verifyArtifactToolImport:true,receiptPath:path.join(root,'.slide-build/validation.json')});
console.log(JSON.stringify(result));
