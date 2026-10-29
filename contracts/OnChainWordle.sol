// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract OnChainWordle {
    
    address public owner;
    bytes5 public secretWord;
    uint256 public constant MAX_ATTEMPT = 6;
    uint256 public wordLength = 5;

    uint256 public currentRound;

    mapping( address => mapping ( uint256 => uint256 ) ) public attempts;
    mapping( address => mapping ( uint256 => bool ) ) public hasWon;

    enum LetterStatus{
        Gray, Yellow, Green
    }

    event GuessSubmitted(
        address indexed player,
        uint256 indexed round,
        string guess, // or else bytes5
        uint8[5] result,
        bool isCorrect,
        uint256 attemptsUsed
    );

    event SecretWordUpdate(bytes5 newSecretWord, uint256 round );

    modifier onlyOwner {
        require( msg.sender == owner, "Only owner are allowed");
        _;
    }

    constructor(string memory _initialsecretWord){
        require( bytes(_initialsecretWord).length == 5, "Word must be of size 5" );
        owner = msg.sender;
        currentRound = 1;
        secretWord = bytes5(bytes(_initialsecretWord));
    }

    function setSecretWord(string memory _newSecretWord)  external onlyOwner {  
        require( bytes( _newSecretWord ).length == 5, "Word must be of size 5" );
        secretWord = bytes5( bytes( _newSecretWord ) );
        currentRound += 1;
        emit SecretWordUpdate(secretWord, currentRound);
    }

    function submitGuess(string memory _guess) external returns (uint8[5] memory result) {
        bytes memory guessBytes = bytes(_guess);

        require(attempts[msg.sender][ currentRound ] < MAX_ATTEMPT, "Player has already used all of his 6 attempt" );
        require(hasWon[msg.sender][currentRound] == false , "Player has already won the Current Round");
        require(guessBytes.length == 5, "Length of the guessed word must be 5");

        bytes memory secretBytes = abi.encodePacked(secretWord);
        bool[5] memory secretMatched;
        bool[5] memory guessMatched;
        bool allCorrect = true;

        for( uint256 i = 0; i < 5; i++){
            if(guessBytes[i] == secretBytes[i]){
                result[i] = uint8(LetterStatus.Green);
                secretMatched[i] = true;
                guessMatched[i] = true;
            }
            else{
                allCorrect = false;
            }
        }

        for(uint256 i = 0; i < 5; i++){
            if( !guessMatched[i] ){
                for( uint256 j = 0; j < 5; j++){
                    if(!secretMatched[j] && secretBytes[j] == guessBytes[i] ){
                        secretMatched[j] = true;
                        result[i] = uint8(LetterStatus.Yellow);
                        break;
                    }
                }    
            }
        }

        attempts[msg.sender][currentRound] += 1;
        
        if(allCorrect){
            hasWon[msg.sender][currentRound] = true;
        }

        emit GuessSubmitted(
            msg.sender,
            currentRound,
            _guess,
            result,
            allCorrect,
            attempts[msg.sender][currentRound]
        );

        return result;
    }
}