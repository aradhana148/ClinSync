import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { finalizePresentation } from '/home/aradhana/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root=process.cwd(), skill='/home/aradhana/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations';
const p=Presentation.create({slideSize:{width:1543,height:838}}),s=p.slides.add();s.background.fill='#F1FCDF';
function box(x,y,w,h,fill){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}})}
function text(t,x,y,w,h,size=28,bold=false,color='#173D30'){const b=box(x,y,w,h,'none');b.text=t;b.text.style={typeface:'Lato',fontSize:size,bold,color};return b;}
text('ICD-10 test suggestions in ClinSync',65,55,1400,70,49,true,'#0B5C39');
text('Four diagnosis shortcuts with editable test selections and visible LOINC references',68,143,1400,48,29);
const flow=[['Select an ICD-10\ndiagnosis','In the Lab Orders tab'],['View the suggested\ntest or panel','LOINC reference displayed'],['Add suggested tests\nand adjust selection','Doctor reviews the choices'],['Confirm with\nCreate Order','Selected tests enter LIS']];
flow.forEach(([a,b],i)=>{const x=65+i*357;box(x,224,335,160,'#DCECE1');box(x,224,57,160,'#BDDDBF');text(String(i+1),x+15,280,40,40,30);text(a,x+72,246,254,77,29);text(b,x+72,337,250,39,19,false,'#426450');});
text('Available diagnosis suggestions',68,417,900,43,31,true);
const values=[['ICD-10','Diagnosis','Suggested test / panel','LOINC'],['E11','Type 2 diabetes mellitus','Fasting blood glucose','1558-6'],['D64.9','Anaemia, unspecified','Complete Blood Count','58410-2'],['E03.9','Hypothyroidism, unspecified','TSH','3016-3'],['E78.5','Hyperlipidaemia, unspecified','Lipid Profile','24331-1']];
const t=s.tables.add({rows:5,columns:4,left:68,top:477,width:922,height:298,columnWidths:[104,290,370,158],values});
t.borders.assign({fill:'#B8CDB0',width:1,style:'solid'});
for(let r=0;r<5;r++){t.rows[r].height=r===0?50:62;for(let c=0;c<4;c++){const cell=t.getCell(r,c);cell.fill=r===0?'#D1E7CE':r%2?'#F5FCEB':'#E7F2DD';cell.text.style={typeface:'Lato',fontSize:23,bold:r===0||c===0,color:'#173D30'};}}
box(1033,431,5,345,'#BBAE7D');
text('How the suggestions work',1060,430,413,80,30,true);
text('Each diagnosis currently suggests one existing test or panel.',1060,515,411,70,26);
text('The doctor can add or remove tests before creating the order.',1060,599,411,77,26);
text('Record the patient’s diagnosis separately in Consultation.',1060,690,411,78,26);
s.speakerNotes.text='Current ClinSync feature, sourced from frontend/src/data/diagnosisPanels.ts, frontend/src/data/loinc.ts and LabOrdersTab in frontend/src/pages/doctor/index.tsx. The dropdown is optional and does not persist an ICD-10 diagnosis to the patient record or order. Add suggested tests adds catalogue IDs without duplicating or clearing existing choices. The doctor confirms with Create Order. The LOINC values here are displayed order-catalogue references; the current order API submits catalogue IDs, not a coded ICD-10-to-LOINC payload, and does not expand panels into individually coded observations. Each of the four shortcuts currently contains one catalogue entry. Reference image supplied by the user; recreated with editable text, workflow and native table. LOINC references: https://loinc.org/1558-6/ ; https://loinc.org/58410-2/ ; https://loinc.org/3016-3/ ; https://loinc.org/24331-1/ .';
await fs.writeFile(path.join(root,'.slide-build/diagnosis-preview.png'),new Uint8Array(await (await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
const candidate=path.join(root,'.slide-build/diagnosis-candidate.pptx');await (await PresentationFile.exportPptx(p)).save(candidate);
await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(root,'outputs/ClinSync-ICD10-test-suggestions.pptx'),pythonExecutable:'/home/aradhana/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','14697075,7981950','--validate-heading-fit','--require-native-table-slide','1'],explicitTotalSlideCount:1,requiredNativeTableOwnerSlides:[1],fontPolicy:{basis:'design',families:['Lato']},verifyArtifactToolImport:true,receiptPath:path.join(root,'.slide-build/diagnosis-validation.json')});
console.log('Saved editable slide.');
