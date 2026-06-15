<script setup lang="ts">
import { playerUpdateEvent, isPlayerDead } from '@bluebottle_gg/league-broadcast-client';
import PlayerItems from './PlayerItems.vue';
import { useIngameSelector } from '@/composables/useIngame';
import PlayerInfo from './PlayerInfo.vue';
import GoldDiff from './GoldDiff.vue';
import ItemBuyNotification from './ItemBuyNotification.vue';
import { useClient } from '@/client';
import { onUnmounted } from 'vue';
import { useNotificationQueue } from '@/composables/useNotificationQueue';


const scoreboard = useIngameSelector((s) => s.gameData.scoreboardBottom);
const tabs = useIngameSelector((s) => s.gameData.tabs);
const gameTime = useIngameSelector((s) => s.gameData.gameTime);
const client = useClient();

const levelUpQueue = useNotificationQueue(2000);
const itemBuyQueue = useNotificationQueue(4000);

/**
 * Find which row index (0-4) and team a player belongs to,
 * based on their name matching scoreboard data.
 */
function findPlayerPosition(playerName: string): { playerIndex: number; team: 'Order' | 'Chaos' } | null {
    if (!scoreboard.value) return null;
    for (let i = 0; i < 5; i++) {
        if (scoreboard.value.teams[0]?.players[i]?.name === playerName) {
            return { playerIndex: i, team: 'Order' };
        }
        if (scoreboard.value.teams[1]?.players[i]?.name === playerName) {
            return { playerIndex: i, team: 'Chaos' };
        }
    }
    return null;
}
const minItemValue = 1800;
const unsub = client.onIngameEvents({
    onPlayerEvent(event: playerUpdateEvent) {
        const pos = findPlayerPosition(event.playerNameAndTagLine);
        if (!pos) return;

        // Queue level-up notifications
        if (event.levelUp) {
            levelUpQueue.enqueue({
                type: 'level-up',
                playerIndex: pos.playerIndex,
                team: pos.team,
                level: event.levelUp[1], // new level after the level-up
            });
        }

        // Queue item-buy notifications
        if (event.boughtItems) {
            for (const item of event.boughtItems) {
                if (item.cost < minItemValue) continue;
                itemBuyQueue.enqueue({
                    type: 'item-buy',
                    playerIndex: pos.playerIndex,
                    team: pos.team,
                    itemIcon: client.getCacheUrl(item.assetUrl),
                    itemName: item.displayName,
                });
            }
        }
    }
})

onUnmounted(() => {
    unsub();
})
</script>



<template>
    <Transition name="slide-down">
        <div id="player-scoreboard" v-if="scoreboard && tabs">
            <div class="player-grid">
                <div v-for="i in 5" :key="i" class="grid-item">
                    <PlayerItems style="grid-area: order-items"
                        :scoreboard-player="scoreboard?.teams[0]?.players[i - 1]"
                        :tab-player="tabs?.['Order']?.players[i - 1]"
                        :grayscale="isPlayerDead(scoreboard?.teams[0]?.players[i - 1], gameTime)" />
                    <PlayerInfo style="grid-area: order-info" :scoreboard-player="scoreboard?.teams[0]?.players[i - 1]"
                        :tab-player="tabs?.['Order']?.players[i - 1]"
                        :level-up-level="levelUpQueue.getActive('Order', i - 1)?.level"
                        :level-up-visible="levelUpQueue.isVisible('Order', i - 1)"
                        :level-up-exiting="levelUpQueue.isExiting('Order', i - 1)" />
                    <GoldDiff style="grid-area: gold-diff"
                        :order-gold="scoreboard?.teams[0]?.players[i - 1]?.totalGold ?? 0"
                        :chaos-gold="scoreboard?.teams[1]?.players[i - 1]?.totalGold ?? 0" />
                    <PlayerInfo style="grid-area: chaos-info" :scoreboard-player="scoreboard?.teams[1]?.players[i - 1]"
                        :tab-player="tabs?.['Chaos']?.players[i - 1]" mirror
                        :level-up-level="levelUpQueue.getActive('Chaos', i - 1)?.level"
                        :level-up-visible="levelUpQueue.isVisible('Chaos', i - 1)"
                        :level-up-exiting="levelUpQueue.isExiting('Chaos', i - 1)" />
                    <PlayerItems style="grid-area: chaos-items"
                        :scoreboard-player="scoreboard?.teams[1]?.players[i - 1]"
                        :tab-player="tabs?.['Chaos']?.players[i - 1]" mirror
                        :grayscale="isPlayerDead(scoreboard?.teams[1]?.players[i - 1], gameTime)" />
                    <!-- Single item-buy overlay per side, spanning both items+info columns -->
                    <ItemBuyNotification v-if="itemBuyQueue.getActive('Order', i - 1)"
                        :item-icon="itemBuyQueue.getActive('Order', i - 1)?.itemIcon"
                        :item-name="itemBuyQueue.getActive('Order', i - 1)?.itemName"
                        :visible="itemBuyQueue.isVisible('Order', i - 1)"
                        :exiting="itemBuyQueue.isExiting('Order', i - 1)" />
                    <ItemBuyNotification v-if="itemBuyQueue.getActive('Chaos', i - 1)"
                        :item-icon="itemBuyQueue.getActive('Chaos', i - 1)?.itemIcon"
                        :item-name="itemBuyQueue.getActive('Chaos', i - 1)?.itemName"
                        :visible="itemBuyQueue.isVisible('Chaos', i - 1)"
                        :exiting="itemBuyQueue.isExiting('Chaos', i - 1)" mirror />
                </div>
            </div>
        </div>
    </Transition>
</template>


<style lang="css" scoped>
#player-scoreboard {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
}

.player-grid {
    background-color: rgba(0, 0, 0, 0.8);
    border: 1px solid var(--border-color);
    border-bottom: 0px;
    border-radius: 8px 8px 0 0;
    display: grid;
    grid-template-rows: repeat(5, minmax(0, 1fr));
    grid-template-columns: 1fr;
}

.player-grid .grid-item {
    border-bottom: 1px solid var(--border-color);
    overflow: hidden;
    min-height: 0;
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: 215px 250px 1fr 250px 215px;
    grid-template-areas: "order-items order-info gold-diff chaos-info chaos-items";

}

.player-grid .grid-item:last-child {
    border-bottom: none;
}

.slide-down-enter-active,
.slide-down-leave-active {
    transition: transform 0.5s ease
}

.slide-down-enter-from,
.slide-down-leave-to {
    transform: translateY(100%);
}
</style>