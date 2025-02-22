<script lang="ts">
    import { chatVisibilityStore, writingStatusMessageStore } from "../../Stores/ChatStore";
    import { onDestroy, onMount } from "svelte";
    import { iframeListener } from "../../Api/IframeListener";
    import { localUserStore } from "../../Connexion/LocalUserStore";
    import { getColorByString } from "../Video/utils";
    import { currentPlayerWokaStore } from "../../Stores/CurrentPlayerWokaStore";
    import type { Unsubscriber } from "svelte/store";
    import { derived, get, writable } from "svelte/store";
    import { gameManager } from "../../Phaser/Game/GameManager";
    import { CHAT_URL } from "../../Enum/EnvironmentVariable";
    import { locale } from "../../../i18n/i18n-svelte";
    import { AdminMessageEventTypes, adminMessagesService } from "../../Connexion/AdminMessagesService";
    import { menuIconVisiblilityStore } from "../../Stores/MenuStore";
    import type { Subscription } from "rxjs";
    import { availabilityStatusStore } from "../../Stores/MediaStore";
    import { peerStore } from "../../Stores/PeerStore";
    import { connectionManager } from "../../Connexion/ConnectionManager";
    import { gameSceneIsLoadedStore } from "../../Stores/GameSceneStore";
    import { Locales } from "../../../i18n/i18n-types";

    let chatIframe: HTMLIFrameElement;

    let subscribeListeners: Array<Unsubscriber> = [];
    let subscribeObservers: Array<Subscription> = [];

    const wokaDefinedStore = writable<boolean>(false);
    const iframeLoadedStore = writable<boolean>(false);

    export const canSendInitMessageStore = derived(
        [wokaDefinedStore, iframeLoadedStore, gameSceneIsLoadedStore],
        ([$wokaDefinedStore, $iframeLoadedStore, $gameSceneIsLoadedStore]) =>
            $wokaDefinedStore && $iframeLoadedStore && $gameSceneIsLoadedStore
    );

    // Phantom woka
    let wokaSrc =
        " data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAdCAYAAABBsffGAAAB/ElEQVRIia1WMW7CQBC8EAoqFy74AD1FqNzkAUi09DROwwN4Ag+gMQ09dcQXXNHQIucBPAJFc2Iue+dd40QZycLc7c7N7d7u+cU9wXw+ryyL0+n00eU9tCZIOp1O/f/ZbBbmzuczX6uuRVTlIAYpCSeTScumaZqw0OVyURd47SIGaZ7n6s4wjmc0Grn7/e6yLFtcr9dPaaOGhcTEeDxu2dxut2hXUJ9ioKmW0IidMg6/NPmD1EmqtojTBWAvE26SW8r+YhfIu87zbyB5BiRerVYtikXxXuLRuK058HABMyz/AX8UHwXgV0NRaEXzDKzaw+EQCioo1yrsLfvyjwZrTvK0yp/xh/o+JwbFhFYgFRNqzGEIB1ZhH2INkXJZoShn2WNSgJRNS/qoYSHxer1+qkhChnC320ULRI1LEsNhv99HISBkLmhP/7L8OfqhiKC6SzEJtSTLHMkGFhK6XC79L89rmtC6rv0YfjXV9COPDwtVQxEc2ZflIu7R+WADQrkA7eCH5BdFwQRXQ8bKxXejeWFoYZGCQM7Yh7BAkcw0DEnEEPHhbjBPQfCDvwzlEINlWZq3OAiOx2O0KwAKU8gehXfzu2Wz2VQMTXqCeLZZSNvtVv20MFsu48gQpDvjuHYxE+ZHESBPSJ/x3sqBvhe0hc5vRXkfypBY4xGcc9+lcFxartG6LgAAAABJRU5ErkJggg==";
    const playUri = window.location.protocol + "//" + window.location.hostname + window.location.pathname;
    let name = localUserStore.getName() ?? "unknown";
    name = name.replace(
        /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu,
        (match) => {
            const codePoint = match.codePointAt(0);
            if (!codePoint) {
                throw new Error("Emoji match codePointAt(0) is undefined");
            }
            return `[e-${codePoint.toString(16)}]`;
        }
    );

    onMount(() => {
        iframeListener.registerChatIframe(chatIframe);
        chatIframe.addEventListener("load", () => {
            iframeLoadedStore.set(false);
            if (chatIframe && chatIframe.contentWindow && "postMessage" in chatIframe.contentWindow) {
                iframeLoadedStore.set(true);
                subscribeListeners.push(
                    locale.subscribe((value: Locales) => {
                        chatIframe?.contentWindow?.postMessage(
                            {
                                type: "setLocale",
                                data: {
                                    locale: value,
                                },
                            },
                            "*"
                        );
                    })
                );
                subscribeListeners.push(
                    currentPlayerWokaStore.subscribe((value) => {
                        if (value !== undefined) {
                            wokaSrc = value;
                            wokaDefinedStore.set(true);
                        }
                    })
                );
                subscribeListeners.push(
                    canSendInitMessageStore.subscribe((value) => {
                        if (value) {
                            iframeListener.sendSettingsToChatIframe();
                            chatIframe?.contentWindow?.postMessage(
                                {
                                    type: "userData",
                                    data: {
                                        ...localUserStore.getLocalUser(),
                                        name,
                                        playUri,
                                        authToken: localUserStore.getAuthToken(),
                                        color: getColorByString(name ?? ""),
                                        woka: wokaSrc,
                                        isLogged: localUserStore.isLogged(),
                                        availabilityStatus: get(availabilityStatusStore),
                                        roomName: connectionManager.currentRoom?.roomName ?? "default",
                                        visitCardUrl: gameManager.myVisitCardUrl,
                                        userRoomToken: gameManager.getCurrentGameScene().connection?.userRoomToken,
                                    },
                                },
                                "*"
                            );
                            chatIframe?.contentWindow?.postMessage(
                                {
                                    type: "setLocale",
                                    data: {
                                        locale: $locale,
                                    },
                                },
                                "*"
                            );
                        }
                    })
                );
                subscribeListeners.push(
                    availabilityStatusStore.subscribe((status) =>
                        iframeListener.sendAvailabilityStatusToChatIframe(status)
                    )
                );
                subscribeListeners.push(
                    chatVisibilityStore.subscribe((visibility) => {
                        try {
                            gameManager.getCurrentGameScene()?.onResize();
                        } catch (err) {
                            console.info("gameManager doesn't exist!", err);
                        }
                        iframeListener.sendChatVisibilityToChatIframe(visibility);
                    })
                );
                subscribeObservers.push(
                    adminMessagesService.messageStream.subscribe((message) => {
                        if (message.type === AdminMessageEventTypes.banned) {
                            chatIframe.remove();
                        }
                        chatVisibilityStore.set(false);
                        menuIconVisiblilityStore.set(false);
                    })
                );

                //TODO delete it with new XMPP integration
                //send list to chat iframe
                subscribeListeners.push(
                    writingStatusMessageStore.subscribe((list) => iframeListener.sendWritingStatusToChatIframe(list))
                );
                subscribeListeners.push(
                    peerStore.subscribe((list) => iframeListener.sendPeerConnexionStatusToChatIframe(list.size > 0))
                );
            }
        });
    });
    onDestroy(() => {
        iframeListener.unregisterIframe(chatIframe);
        subscribeListeners.forEach((listener) => {
            listener();
        });
        subscribeObservers.forEach((observer) => {
            observer.unsubscribe();
        });
    });

    function closeChat() {
        chatVisibilityStore.set(false);
    }
    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape" && $chatVisibilityStore) {
            closeChat();
            chatIframe.blur();
        }
    }
</script>

<svelte:window on:keydown={onKeyDown} />
<div id="chatWindow" class:show={$chatVisibilityStore}>
    {#if $chatVisibilityStore}<div class="hide">
            <button class="close-window" on:click={closeChat}>&#215;</button>
        </div>{/if}
    <iframe
        id="chatWorkAdventure"
        bind:this={chatIframe}
        allow="fullscreen; clipboard-read; clipboard-write"
        title="WorkAdventureChat"
        src={CHAT_URL}
        class="tw-border-0"
    />
</div>

<style lang="scss">
    @import "../../style/breakpoints.scss";

    @include media-breakpoint-up(sm) {
        #chatWindow {
            width: calc(100% - 20px) !important;
        }
    }

    #chatWindow {
        z-index: 1000;
        position: absolute;
        background-color: transparent;
        top: 0;
        left: -100%;
        height: 100%;
        width: 28%;
        min-width: 335px;
        transition: all 0.2s ease-in-out;
        pointer-events: none;
        visibility: hidden;
        &.show {
            left: 0;
            pointer-events: auto;
            visibility: visible;
        }
        iframe {
            width: 100%;
            height: 100%;
        }
        .hide {
            top: 13px;
            position: absolute;
            right: 12px;
            width: fit-content;
            height: fit-content;
            .close-window {
                height: 1.6rem;
                width: 1.6rem;
                position: initial;
            }
        }
    }
</style>
