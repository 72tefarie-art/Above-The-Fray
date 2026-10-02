const { executePlayerTrade } = require('./inventoryService');

async function runTest() {
  try {
    // Alice gives Bob 1x Health Potion
    // Bob gives Alice 50x Gold Coins
    await executePlayerTrade(
      'p_alice', 
      'p_bob', 
      [{ itemId: 'health_potion', quantity: 1 }], 
      [{ itemId: 'gold_coin', quantity: 50 }]
    );
  } catch (err) {
    console.log('Trade error handled cleanly.');
  }
}

runTest();