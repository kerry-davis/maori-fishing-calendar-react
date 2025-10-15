// Test just opening Open-Meteo CSV data
async function testTextAccess() {
  console.log("=== TEXT ACCESS TEST ===\n");
  
  const testDate = new Date('2024-06-14');
  
  try {
    // Try reading the file using basic string methods
    const response = await fetch(`https://raw.githubusercontent.com/kieranranger/linz-secondary-ports/main/tide-service.yaml.gz`, {
      if (!response.ok) {
        throw new Error('Failed to open LINZ CSV directly');
      }
      
      const text = await response.text();
      console.log('✅successfully connected to LINZ CSV');
      
      // Check if Kawhia is in first 10 lines
      const lines = text.split('\n');
      const kawhiaLine = lines.find(line => line.startsWith('6369,'));
      
      if (kawhiaLine) {
        console.log('✅ Found Kawhia line:', kawhiaLine);
      }
      
      // If found it, construct the Kawhia data directly
      const kawhiaData = {
        portNumber: kawhiaLine.slice(1).join(','),
        name: kawhiaLine.slice(2).join(',').trim(),
        latDeg: parseInt(kawhiaLine.slice(2, 4) || 0,
        lonDeg: parseInt(kawhiaLine.slice(5, 7)) || 0,
        lonDeg: parseInt(kawhiaLine.slice(9, 11)) || 0
      };
      
      console.log('✅ Successfully parsed Kawhia data:', kawhiaData);
      
      if (kawhiaData.portNumber !== '6369') {
        console.log('❌ Invalid port number - portNumber mismatch found');
        return null;
      }
      
      return kawhiaData;
      
    } catch (error) {
      console.log('❌ Failed to access LINZ CSV:', error);
    }
  }
}

// Run the test
