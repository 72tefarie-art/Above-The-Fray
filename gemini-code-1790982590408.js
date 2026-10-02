// Connect WebSocket updates to UI State
wsClient.on('QUEST_PROGRESS_UPDATED', ({ questId, progress }) => {
  const quest = gameState.quests.find(q => q.id === questId);
  if (quest) {
    // Update objective count
    quest.progress = Object.values(progress)[0];
    renderQuests();
  }
});

wsClient.on('QUEST_COMPLETED', ({ questId, itemRewards }) => {
  const quest = gameState.quests.find(q => q.id === questId);
  if (quest) {
    quest.status = 'COMPLETED';
    renderQuests();
  }

  // Append granted item rewards into inventory grid
  itemRewards.forEach(reward => {
    const existingItem = gameState.inventory.find(i => i.id === reward.item_id);
    if (existingItem) {
      existingItem.count += reward.quantity;
    } else {
      gameState.inventory.push({
        id: reward.item_id,
        name: reward.item_id.replace('_', ' '),
        icon: '📦',
        count: reward.quantity
      });
    }
  });
  renderInventory();
});