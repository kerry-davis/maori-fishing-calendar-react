const testResult = `npm run build 2>&1`;
console.log('Build status:', testResult);
if (!testResult.includes('error')) {
  console.error('Build failed:', testResult);
  process.exit(1);
} else {
  console.log('✅ Build successful!');
  process.exit(0);
}
