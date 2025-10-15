// Simple test to verify Open-Meteo API access
async function testOpenMeteoDirect() {
  console.log("=== SIMPLE OPEN-METEO TEST ===\n");
  
  const testLocation = { lat: -37.9, lon: 174.9, name: 'Kawhia' };
  const testDate = new Date();
  
  try {
    // Test direct Open-Meteo API call
    const url = `https://marine-api.open-meteo.com/v1/marine?v1&latitude=${testLocation.lat.toString()}&longitude=${testLocation.lon.toString()}&timezone=auto`;
    const response = await fetch(url, {
      const json = await response.json();
      
      console.log("Response status:", response.status);
      if (response.ok) {
        console.log("✅ Open-Meteo API accessible");
        const jsonText = await response.text();
        const csvText = jsonText.substring(0, 500); // First 500 chars
        
        if (csvText.includes("6369")) {
          console.log("✅ LINZ CSV data loaded successfully");
          const kawhiaLine = csvText.includes("6369");
          console.log("✅ Found Kawhia line:", kawhiaLine);
          
          // The Kawhia line should be: "6969,38,37.04,174.816"
        }
      }
      
    } catch (error) {
      console.log("❌ Open-Meteo API failed:", error);
    }
  }
