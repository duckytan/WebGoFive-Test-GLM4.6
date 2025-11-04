// Simple test to check module loading
console.log('Testing module loading...');

// Check if required modules are loaded
const requiredModules = [
    'EventBus', 'Logger', 'GameState', 'RuleEngine', 'AIEngine',
    'CanvasRenderer', 'HudPanel', 'SaveLoadService', 'ReplayService',
    'ModeManager', 'GameController'
];

console.log('Checking modules:');
requiredModules.forEach(name => {
    if (typeof window[name] !== 'undefined') {
        console.log(`✓ ${name} is available`);
    } else {
        console.log(`✗ ${name} is NOT available`);
    }
});

// Test basic functionality
if (typeof window.logger !== 'undefined') {
    console.log('✓ logger instance is available');
    try {
        const testLogger = window.logger.createModuleLogger('Test');
        console.log('✓ createModuleLogger works');
        testLogger.info('Test log message');
        console.log('✓ Logging works');
    } catch (e) {
        console.log('✗ createModuleLogger failed:', e.message);
    }
} else {
    console.log('✗ logger instance is NOT available');
}

// Test event bus
if (typeof window.EventBus !== 'undefined') {
    console.log('✓ EventBus class is available');
    try {
        const testBus = new window.EventBus();
        console.log('✓ EventBus instantiation works');
        testBus.on('test', () => console.log('✓ EventBus event handling works'));
        testBus.emit('test');
        console.log('✓ EventBus emit works');
    } catch (e) {
        console.log('✗ EventBus failed:', e.message);
    }
} else {
    console.log('✗ EventBus class is NOT available');
}

console.log('Module loading test complete.');