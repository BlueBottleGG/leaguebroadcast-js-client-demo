<script setup lang="ts">
import { computed } from 'vue'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import type { ActiveAnnouncement } from './useAnnouncerQueue'
import brandLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'

const props = defineProps<{
  announcement: ActiveAnnouncement
}>()

const client = useClient()

const teamClass = computed(() => {
  if (props.announcement.team === 1) return 'order'
  if (props.announcement.team === 2) return 'chaos'
  return 'neutral'
})
</script>

<template>
  <div
    class="announcer-banner"
    :class="[
      teamClass,
      announcement.variant,
      { branded: announcement.branded, major: !!announcement.title },
    ]"
  >
    <div v-if="announcement.branded" class="brand-chip">
      <img class="brand-logo" :src="brandLogo" alt="BlueBottle" />
    </div>

    <img
      v-if="announcement.sourceIcon"
      :src="client.getCacheUrl(announcement.sourceIcon)"
      class="icon"
      alt=""
      @error="handleImageError"
      @load="handleImageLoad"
    />

    <div class="text">
      <div v-if="announcement.eyebrow" class="eyebrow">{{ announcement.eyebrow }}</div>
      <div v-if="announcement.title" class="title">{{ announcement.title }}</div>
      <div v-if="announcement.detail" class="detail">{{ announcement.detail }}</div>
    </div>

    <img
      v-if="announcement.targetIcon"
      :src="client.getCacheUrl(announcement.targetIcon)"
      class="icon victim"
      alt=""
      @error="handleImageError"
      @load="handleImageLoad"
    />
  </div>
</template>

<style lang="css" scoped>
.announcer-banner {
  --announcer-accent: rgba(226, 232, 240, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 6px 64px;
  min-height: 48px;
  min-width: 460px;
  background: linear-gradient(
    90deg,
    transparent 0,
    rgba(8, 10, 18, 0.88) 56px,
    rgba(8, 10, 18, 0.88) calc(100% - 56px),
    transparent 100%
  );
  font-family: 'Bebas Neue';
  font-synthesis: none;
  position: relative;
  pointer-events: none;
}

.announcer-banner.order {
  --announcer-accent: var(--blue-team-color);
}

.announcer-banner.chaos {
  --announcer-accent: var(--red-team-color);
}

/* Hairlines fading out toward the edges */
.announcer-banner::before,
.announcer-banner::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--announcer-accent) 30%,
    var(--announcer-accent) 70%,
    transparent 100%
  );
}

.announcer-banner::before {
  top: 0;
}

.announcer-banner::after {
  bottom: 0;
}

.announcer-banner.branded::before,
.announcer-banner.branded::after {
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--broadcast-accent) 30%,
    var(--broadcast-accent) 70%,
    transparent 100%
  );
}

.brand-chip {
  display: flex;
  align-items: center;
  padding-right: 12px;
  border-right: 1px solid rgba(226, 232, 240, 0.25);
}

.brand-logo {
  height: 32px;
  width: 32px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.icon {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-xs);
  outline: 1px solid rgba(226, 232, 240, 0.25);
}

.icon.victim {
  filter: grayscale(0.5);
}

.text {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.05;
  padding: 2px 4px;
}

.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 4px;
  color: rgba(226, 232, 240, 0.72);
}

.title {
  font-size: 26px;
  letter-spacing: 3px;
  color: var(--announcer-accent);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

.announcer-banner.neutral .title {
  color: #e2e8f0;
}

.detail {
  font-size: 17px;
  letter-spacing: 1.5px;
  color: rgba(226, 232, 240, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

/* Minor (detail-only) banners are slimmer */
.announcer-banner:not(.major) {
  min-height: 40px;
  padding: 4px 56px;
  min-width: 380px;
}

.announcer-banner:not(.major) .icon {
  width: 42px;
  height: 42px;
}

.announcer-banner:not(.major) .detail {
  font-size: 17px;
}

/* Lord Grompulus receives the excessive ceremony his full name demands. */
.announcer-banner.gromp-grand {
  --announcer-accent: #e4c16f;
  width: 1040px;
  min-width: 1040px;
  min-height: 156px;
  gap: 24px;
  padding: 22px 104px;
  border: 1px solid rgb(228 193 111 / 0.72);
  clip-path: polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%);
  background:
    radial-gradient(circle at 50% 50%, rgb(91 67 26 / 0.48), transparent 42%),
    linear-gradient(90deg, transparent, rgb(9 10 15 / 0.97) 10% 90%, transparent);
  filter: drop-shadow(0 10px 22px rgb(0 0 0 / 0.72));
}

.announcer-banner.gromp-grand::before,
.announcer-banner.gromp-grand::after {
  left: 8%;
  right: 8%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    #8a672c 18%,
    #f0d792 50%,
    #8a672c 82%,
    transparent
  );
  box-shadow: 0 0 12px rgb(228 193 111 / 0.42);
}

.gromp-grand .text {
  width: 720px;
  gap: 7px;
}

.gromp-grand .eyebrow {
  color: #f0d792;
  font-size: 12px;
  letter-spacing: 6px;
  text-shadow: 0 0 12px rgb(228 193 111 / 0.5);
}

.gromp-grand .title {
  max-width: 720px;
  color: #fff2c8;
  font-size: 32px;
  font-weight: 900;
  line-height: 0.98;
  letter-spacing: 2.4px;
  text-align: center;
  text-transform: uppercase;
  text-wrap: balance;
  text-shadow:
    0 2px 0 #5b431a,
    0 0 18px rgb(228 193 111 / 0.28);
}

.gromp-grand .detail {
  color: rgb(247 237 211 / 0.86);
  font-size: 15px;
  font-style: normal;
  font-weight: 400;
  letter-spacing: 0.8px;
  text-align: center;
}

.gromp-grand .icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  outline: 2px solid #e4c16f;
  outline-offset: 4px;
  box-shadow:
    0 0 0 1px #5b431a,
    0 0 22px rgb(228 193 111 / 0.32);
}

/* The frame opens first; typography and portraits follow in ceremonial beats. */
.announcer-enter-active.gromp-grand {
  animation: gromp-frame-in 1050ms cubic-bezier(0.16, 1, 0.3, 1) both;
  will-change: clip-path, filter, opacity, transform;
}

.announcer-enter-active.gromp-grand::before,
.announcer-enter-active.gromp-grand::after {
  animation: gromp-rule-in 720ms 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.announcer-enter-active.gromp-grand .icon:not(.victim) {
  animation: gromp-source-in 620ms 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.announcer-enter-active.gromp-grand .icon.victim {
  animation: gromp-target-in 620ms 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.announcer-enter-active.gromp-grand .eyebrow {
  animation: gromp-copy-in 500ms 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.announcer-enter-active.gromp-grand .title {
  animation: gromp-copy-in 600ms 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.announcer-enter-active.gromp-grand .detail {
  animation: gromp-copy-in 520ms 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.announcer-leave-active.gromp-grand {
  animation: gromp-frame-out 760ms cubic-bezier(0.7, 0, 0.84, 0) both;
  will-change: clip-path, filter, opacity, transform;
}

.announcer-leave-active.gromp-grand .detail {
  animation: gromp-copy-out 180ms ease-in both;
}

.announcer-leave-active.gromp-grand .title {
  animation: gromp-copy-out 220ms 70ms ease-in both;
}

.announcer-leave-active.gromp-grand .eyebrow {
  animation: gromp-copy-out 180ms 130ms ease-in both;
}

.announcer-leave-active.gromp-grand .icon {
  animation: gromp-icon-out 260ms 70ms ease-in both;
}

.announcer-leave-active.gromp-grand::before,
.announcer-leave-active.gromp-grand::after {
  animation: gromp-rule-out 300ms 130ms ease-in both;
}

@keyframes gromp-frame-in {
  from {
    opacity: 0;
    clip-path: polygon(50% 0, 50% 0, 50% 50%, 50% 100%, 50% 100%, 50% 50%);
    transform: translateY(-14px) scaleX(0.74);
    filter: drop-shadow(0 0 0 transparent);
  }
  48% {
    opacity: 1;
    clip-path: polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%);
    transform: translateY(0) scaleX(1.018);
    filter: drop-shadow(0 12px 30px rgb(0 0 0 / 0.82));
  }
  to {
    opacity: 1;
    clip-path: polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%);
    transform: translateY(0) scaleX(1);
    filter: drop-shadow(0 10px 22px rgb(0 0 0 / 0.72));
  }
}

@keyframes gromp-frame-out {
  from {
    opacity: 1;
    clip-path: polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%);
    transform: translateY(0) scaleX(1);
    filter: drop-shadow(0 10px 22px rgb(0 0 0 / 0.72));
  }
  46% {
    opacity: 1;
    clip-path: polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%);
    transform: translateY(-2px) scaleX(1.012);
    filter: drop-shadow(0 8px 26px rgb(228 193 111 / 0.24));
  }
  to {
    opacity: 0;
    clip-path: polygon(50% 0, 50% 0, 50% 50%, 50% 100%, 50% 100%, 50% 50%);
    transform: translateY(-10px) scaleX(0.58);
    filter: drop-shadow(0 0 0 transparent);
  }
}

@keyframes gromp-rule-in {
  from {
    opacity: 0;
    transform: scaleX(0);
  }
  to {
    opacity: 1;
    transform: scaleX(1);
  }
}

@keyframes gromp-rule-out {
  from {
    opacity: 1;
    transform: scaleX(1);
  }
  to {
    opacity: 0;
    transform: scaleX(0);
  }
}

@keyframes gromp-copy-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gromp-copy-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-7px);
  }
}

@keyframes gromp-source-in {
  from {
    opacity: 0;
    transform: translateX(18px) rotate(-8deg) scale(0.72);
  }
  to {
    opacity: 1;
    transform: translateX(0) rotate(0) scale(1);
  }
}

@keyframes gromp-target-in {
  from {
    opacity: 0;
    transform: translateX(-18px) rotate(8deg) scale(0.72);
  }
  to {
    opacity: 1;
    transform: translateX(0) rotate(0) scale(1);
  }
}

@keyframes gromp-icon-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.72);
  }
}

@media (prefers-reduced-motion: reduce) {
  .announcer-enter-active.gromp-grand,
  .announcer-leave-active.gromp-grand,
  .announcer-enter-active.gromp-grand::before,
  .announcer-enter-active.gromp-grand::after,
  .announcer-leave-active.gromp-grand::before,
  .announcer-leave-active.gromp-grand::after,
  .announcer-enter-active.gromp-grand .icon,
  .announcer-enter-active.gromp-grand .eyebrow,
  .announcer-enter-active.gromp-grand .title,
  .announcer-enter-active.gromp-grand .detail,
  .announcer-leave-active.gromp-grand .icon,
  .announcer-leave-active.gromp-grand .eyebrow,
  .announcer-leave-active.gromp-grand .title,
  .announcer-leave-active.gromp-grand .detail {
    animation: none;
  }
}
</style>
