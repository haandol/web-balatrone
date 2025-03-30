// composables/useBalatroGame.ts
import { evaluateHand, calculateScore, type Card } from '@/utils/poker';
import { JOKER_DATABASE, type Joker } from '@/utils/joker';

export function useBalatroGame() {
    const gameStore = useGameStore();

    // 스토어 상태 가져오기
    const {
        deck,
        playerHand,
        selectedCards,
        handSize,
        currentAnteIndex,
        currentBlindIndex,
        currentRoundScore,
        handsLeft,
        discardsLeft,
        lastPlayedHandInfo,
        isGameOver,
        currentBlind,
        activeJokers,
        money,
        antes,
    } = storeToRefs(gameStore);

    // 덱 초기화
    const initializeDeck = () => {
        gameStore.deck = [];
        gameStore.cardIdCounter = 0;
        const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
        // @ts-ignore ranks가 스토어 상태에 없을 수 있음 (store.ranks 사용 필요 시)
        const ranks = gameStore.ranks || ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // 스토어 값 또는 기본값 사용
        const newDeck: Card[] = [];
        let tempIdCounter = 0;
        for (const suit of suits) {
            for (const rank of ranks) {
                newDeck.push({ id: tempIdCounter++, suit, rank });
            }
        }
        gameStore.deck = newDeck;
        gameStore.cardIdCounter = tempIdCounter;
    };

    // 덱 셔플
    const shuffleDeck = () => {
        const array = gameStore.deck;
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    };

    // 카드 뽑기
    const drawCards = (count: number) => {
        if (gameStore.isGameOver) return;
        const cardsToDraw = Math.min(count, gameStore.deck.length, gameStore.handSize - gameStore.playerHand.length);
        if (cardsToDraw > 0) {
            const newCards = gameStore.deck.splice(0, cardsToDraw);
            gameStore.playerHand.push(...newCards);
        }
    };

    // 라운드 상태 초기화 함수 (액션 대신 직접 구현)
    const resetRoundState = () => {
        gameStore.currentRoundScore = 0;
        gameStore.handsLeft = 4; // 기본값 사용 또는 스토어 기본값 참조
        gameStore.discardsLeft = 3; // 기본값 사용
        gameStore.selectedCards = [];
        gameStore.lastPlayedHandInfo = null;
        // 이전 라운드 관련 상태 초기화
        // (previousPlayedJokers는 제거 - 필요없는 상태)
    };

     // 다음 블라인드 시작 준비
     const startNextBlind = () => {
        if (!currentBlind.value) {
            console.log("All antes cleared or error!");
            gameStore.isGameOver = true;
            return;
        }
        resetRoundState();
        // 플레이어 핸드가 비어 있으면 카드를 채움
        if (gameStore.playerHand.length === 0) {
            gameStore.playerHand = [];
        }
        // 새 라운드를 시작할 때 항상 handSize만큼 카드를 채움
        drawCards(gameStore.handSize - gameStore.playerHand.length);
        if (currentBlind.value) {
            console.log(`Starting Ante ${gameStore.currentAnteIndex + 1}, ${currentBlind.value.name}. Target: ${currentBlind.value.targetScore}`);
        }
    };

    // 다음 블라인드 또는 안테로 진행
     const advanceToNextBlind = () => {
        console.log(`${currentBlind.value?.name} Cleared!`);
        // TODO: 보상 처리 (money 상태 업데이트 등)
        // 예: gameStore.money += currentBlind.value?.reward || 0;

        // 블라인드를 클리어했으므로 라운드 관련 상태 초기화
        resetRoundState();

        gameStore.currentBlindIndex++;
        if (gameStore.currentBlindIndex >= gameStore.antes[gameStore.currentAnteIndex].blinds.length) {
            gameStore.currentAnteIndex++;
            gameStore.currentBlindIndex = 0;
            if (gameStore.currentAnteIndex >= gameStore.antes.length) {
                console.log("Congratulations! You cleared all Antes!");
                gameStore.isGameOver = true;
                return;
            } else {
                 console.log(`Advancing to Ante ${gameStore.currentAnteIndex + 1}`);
                 initializeDeck();
                 shuffleDeck();
                 // 새 안테에서는 플레이어 핸드를 비우고 다시 시작
                 gameStore.playerHand = [];
            }
        }
        startNextBlind();
    };

    // 게임 오버 처리
    const handleGameOver = () => {
        console.log("Game Over!");
        gameStore.isGameOver = true;
    };

     // 게임 초기화 함수
     const initializeGame = () => {
        gameStore.isGameOver = false;
        gameStore.currentAnteIndex = 0;
        gameStore.currentBlindIndex = 0;
        gameStore.money = 4; // 초기 자금 설정
        gameStore.activeJokers = []; // 조커 초기화
        gameStore.playerHand = []; // 플레이어 핸드 초기화
        resetRoundState(); // 라운드 상태 초기화 포함

        // 디버깅: 조커 상태 확인
        console.log('Game initialized. Active jokers:', gameStore.activeJokers.length);
    };

    // 게임 시작 또는 재시작
    const startGame = () => {
        // gameStore.initializeGame(); // 액션 호출 대신 직접 함수 호출
        initializeGame();

        initializeDeck();
        shuffleDeck();
        startNextBlind();
    };

    // 게임 재시작
    const restartGame = () => {
        startGame();
    };

    // 카드 선택 토글
    const toggleCardSelection = (card: Card) => {
        if (gameStore.isGameOver) return;
        const index = gameStore.selectedCards.findIndex(selected => selected.id === card.id);
        if (index > -1) {
            gameStore.selectedCards.splice(index, 1);
        } else {
            if (gameStore.selectedCards.length < 5) {
                gameStore.selectedCards.push(card);
            } else {
                alert("You can select a maximum of 5 cards.");
            }
        }
    };

    // 핸드 플레이
    const playHand = () => {
        if (!gameStore.canPlay || !currentBlind.value) return;

        console.log("Attempting to play hand...");
        gameStore.lastPlayedHandInfo = null;

        const evaluation = evaluateHand(gameStore.selectedCards);
        if (!evaluation) {
            console.error("Could not evaluate hand.");
            return;
        }

        // 활성화된 조커가 있는지 확인하고 로그 출력
        const jokersToApply = gameStore.activeJokers && gameStore.activeJokers.length > 0 ? gameStore.activeJokers : [];
        console.log(`Using ${jokersToApply.length} active jokers for score calculation`);
        // 디버깅을 위해 조커 목록 출력
        if (jokersToApply.length > 0) {
            console.log('Active jokers:', jokersToApply.map(joker => joker.name).join(', '));
        }

        const scoreResult = calculateScore(evaluation, gameStore.selectedCards, jokersToApply);

        // 상태 업데이트: 직접 스토어에 값을 할당하여 반응성 보장
        gameStore.currentRoundScore += scoreResult.totalScore;
        gameStore.handsLeft -= 1; // handsLeft 감소
        gameStore.lastPlayedHandInfo = { handRank: scoreResult.handRank, score: scoreResult.totalScore };

        const playedCardIds = new Set(gameStore.selectedCards.map(c => c.id));
        // 플레이어 핸드 업데이트: 새 배열 할당으로 반응성 보장
        gameStore.playerHand = gameStore.playerHand.filter(card => !playedCardIds.has(card.id));
        gameStore.selectedCards = []; // 선택된 카드 초기화
        drawCards(playedCardIds.size);

        if (currentBlind.value && gameStore.currentRoundScore >= currentBlind.value.targetScore) { // currentBlind null 체크 추가
            advanceToNextBlind();
        } else if (gameStore.handsLeft === 0) {
             if(gameStore.discardsLeft === 0) {
                 handleGameOver();
             } else {
                 console.log("Hands depleted, but discards remain.");
                 // 손이 0이 되고 점수가 목표에 도달하지 못했는지 확인
                 if (currentBlind.value && gameStore.currentRoundScore < currentBlind.value.targetScore) {
                     console.log(`Failed to reach target score. Current: ${gameStore.currentRoundScore}, Target: ${currentBlind.value.targetScore}`);
                     handleGameOver();
                 }
             }
        }
    };

    // 카드 버리기
    const discardCards = () => {
        if (!gameStore.canDiscard || !currentBlind.value) return;

        console.log("Attempting to discard cards...");
        gameStore.lastPlayedHandInfo = null;

        gameStore.discardsLeft -= 1;

        const discardedCardIds = new Set(gameStore.selectedCards.map(c => c.id));
        gameStore.playerHand = gameStore.playerHand.filter(card => !discardedCardIds.has(card.id));
        const numberOfDiscards = gameStore.selectedCards.length;
        gameStore.selectedCards = [];
        drawCards(numberOfDiscards);

        if (currentBlind.value && gameStore.handsLeft === 0 && gameStore.discardsLeft === 0 && gameStore.currentRoundScore < currentBlind.value.targetScore) {
            handleGameOver();
        }
    };

    // 반환할 함수들
    return {
        startGame,
        restartGame,
        toggleCardSelection,
        playHand,
        discardCards,
    };
}