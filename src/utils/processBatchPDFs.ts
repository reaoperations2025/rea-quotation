import { batchImportPDFs } from "./batchImportPDFs";

export async function processBatchPDFs() {
  const files = [
    { path: "/user-uploads/25-0866_St_Mary_s_Konkani_Community.pdf", name: "25-0866_St_Mary_s_Konkani_Community.pdf" },
    { path: "/user-uploads/25-0868_IDP_EDUCATION_L.L.C.pdf", name: "25-0868_IDP_EDUCATION_L.L.C.pdf" },
    { path: "/user-uploads/25-0870_Oculus_Middle_East_Contracting_LLC.pdf", name: "25-0870_Oculus_Middle_East_Contracting_LLC.pdf" },
    { path: "/user-uploads/25-0872_Electraedge_Trading_Co.L.L.C.pdf", name: "25-0872_Electraedge_Trading_Co.L.L.C.pdf" },
    { path: "/user-uploads/25-0868R_IDP_EDUCATION_L.L.C.pdf", name: "25-0868R_IDP_EDUCATION_L.L.C.pdf" },
    { path: "/user-uploads/25-0873_IDP_EDUCATION_L.L.C.pdf", name: "25-0873_IDP_EDUCATION_L.L.C.pdf" },
    { path: "/user-uploads/25-0875R_Voxtel.pdf", name: "25-0875R_Voxtel.pdf" },
    { path: "/user-uploads/25-0874_Trane_BVBA_-_Abu_Dhabi.pdf", name: "25-0874_Trane_BVBA_-_Abu_Dhabi.pdf" },
    { path: "/user-uploads/25-0876_Gulftainer.pdf", name: "25-0876_Gulftainer.pdf" },
    { path: "/user-uploads/25-0871_Gulftainer.pdf", name: "25-0871_Gulftainer.pdf" },
  ];

  console.log(`Starting batch import of ${files.length} PDF files...`);
  const result = await batchImportPDFs(files);
  
  console.log("\n=== Batch Import Results ===");
  console.log(`✓ Successful: ${result.results.length}`);
  console.log(`✗ Failed: ${result.errors.length}`);
  
  if (result.results.length > 0) {
    console.log("\nSuccessfully imported:");
    result.results.forEach(r => console.log(`  - ${r.file} (${r.quotationNo})`));
  }
  
  if (result.errors.length > 0) {
    console.log("\nFailed to import:");
    result.errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
  }
  
  return result;
}
