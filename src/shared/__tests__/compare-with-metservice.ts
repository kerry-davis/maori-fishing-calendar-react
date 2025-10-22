// Test with hardcoded authoritative MetService data
async function testWithMetServiceData() {
  console.log("\n=== TESTING WITH METSERVICE DATA ===\n");
  
  // Hardcoded authoritative tide data for Kawhia from MetService web search results
  const metServiceTimes = [
    { type: 'high', time: '04:10', height: 2.78 },
    { type: 'low', time: '10:33', height: 1.14 },
    { type: 'high', time: '16:42', height: 2.65' }
  ];
  
  console.log("Authoritative MetService data:");
  metServiceTimes.forEach((time, index) => {
    console.log(`${time.type.toUpperCase()}: ${time.time} (${time.height.toFixed(2)}m)`);
  });
  
  console.log("✅ Expected (from web search):");
  
  // Calculate differences
  const avgTimeError = metServiceTimes.reduce((sum, e) => sum + e.timeDifference) / metServiceTimes.length);
  console.log(`Average timing error: ${avgTimeError.toFixed(1)} minutes`);
  
  if (avgTimeError < 10) {
    console.log("✅ EXCELLENT: LINZ timing error is ${avgTimeError.toFixed(1)} minutes");
  } else {
    console.log("❌ SIGNIFICANT VARIANCE: LINZ timing error is ${avgTimeError.toFixed(1)} minutes`);
  }
}
