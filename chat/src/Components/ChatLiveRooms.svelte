<script lang="ts">
    import ChatMucRoom from "./ChatMucRoom.svelte";
    import { MucRoom } from "../Xmpp/MucRoom";
    import { showLivesStore } from "../Stores/ChatStore";

    export let liveRooms: MucRoom[];
    export let searchValue: string;
</script>

{#if liveRooms.length > 0}
    <div id="liveRooms" class="tw-border-b tw-border-solid tw-border-0 tw-border-transparent tw-border-b-light-purple">
        <div
            class="tw-px-4 tw-py-1 tw-flex tw-items-center tw-cursor-pointer"
            on:click|stopPropagation={() => showLivesStore.set(!$showLivesStore)}
        >
            <span
                class="tw-bg-light-blue tw-text-dark-purple tw-w-5 tw-h-5 tw-mr-3 tw-text-sm tw-font-semibold tw-flex tw-items-center tw-justify-center tw-rounded"
            >
                {liveRooms.length}
            </span>
            <p class="tw-text-light-blue tw-my-2 tw-text-sm tw-flex-auto">Live zones</p>
            <!--<button class="tw-text-lighter-purple">
                <ChevronUpIcon class={`tw-transform tw-transition ${$showLivesStore ? "" : "tw-rotate-180"}`} />
            </button>
            -->
        </div>
        <div>
            {#each liveRooms as liveRoom}
                <ChatMucRoom mucRoom={liveRoom} {searchValue} />
            {/each}
        </div>
    </div>
{/if}
