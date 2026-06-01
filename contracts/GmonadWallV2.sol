// SPDX-License-Identifier: MIT
// ============================================================
// EDUCATIONAL / UNAUDITED DISCLAIMER
// This contract has not been professionally audited.
// It is provided for educational and experimental purposes
// on Monad Testnet only. Do not use in production or with
// real funds without a full security audit.
// ============================================================
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract GmonadWallV2 is Ownable {

    // ─── Media type constants ────────────────────────────────
    uint8 public constant MEDIA_NONE  = 0;
    uint8 public constant MEDIA_IMAGE = 1;
    uint8 public constant MEDIA_GIF   = 2;

    // ─── Read cap ───────────────────────────────────────────
    uint256 public constant MAX_READ = 50;

    // ─── Configurable limits ─────────────────────────────────
    uint256 public cooldown        = 60 seconds;
    uint256 public maxTextLength   = 120;
    uint256 public maxMediaURILength = 300;

    // ─── Nad identity ────────────────────────────────────────
    uint256 public nextNadId = 1;
    mapping(address => uint256) public nadIdOf;
    mapping(uint256 => address) public ownerOfNad;

    // ─── Posts ───────────────────────────────────────────────
    struct Post {
        address author;
        uint256 nadId;
        string  text;
        string  mediaURI;
        uint8   mediaType;
        uint256 timestamp;
        bool    hidden;
    }

    Post[]   private posts;
    mapping(address => uint256[]) private postsByWallet;
    mapping(address => uint256)   private lastPostTime;

    // ─── Events ──────────────────────────────────────────────
    event NadAssigned(address indexed user, uint256 indexed nadId);
    event PostCreated(
        uint256 indexed postId,
        address indexed author,
        uint256 indexed nadId,
        uint256 timestamp
    );
    event PostHidden(uint256 indexed postId, bool hidden);
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event MaxTextLengthUpdated(uint256 oldMax, uint256 newMax);
    event MaxMediaURILengthUpdated(uint256 oldMax, uint256 newMax);

    // ─── Constructor ─────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ─── Internal helpers ────────────────────────────────────

    /// Auto-assigns a Nad ID to a wallet the first time it posts.
    function _assignNadIfNeeded(address user) internal returns (uint256) {
        if (nadIdOf[user] == 0) {
            uint256 id = nextNadId++;
            nadIdOf[user]   = id;
            ownerOfNad[id]  = user;
            emit NadAssigned(user, id);
        }
        return nadIdOf[user];
    }

    /// Shared pre-post validation: cooldown and text length.
    function _validatePost(string calldata text) internal view {
        require(bytes(text).length > 0,            "Text required");
        require(bytes(text).length <= maxTextLength, "Text too long");
        require(
            block.timestamp >= lastPostTime[msg.sender] + cooldown,
            "Cooldown active"
        );
    }

    /// Core storage write after validation.
    function _storePost(
        string memory text,
        string memory mediaURI,
        uint8 mediaType
    ) internal returns (uint256 postId) {
        uint256 nadId = _assignNadIfNeeded(msg.sender);
        postId = posts.length;

        posts.push(Post({
            author:    msg.sender,
            nadId:     nadId,
            text:      text,
            mediaURI:  mediaURI,
            mediaType: mediaType,
            timestamp: block.timestamp,
            hidden:    false
        }));

        postsByWallet[msg.sender].push(postId);
        lastPostTime[msg.sender] = block.timestamp;

        emit PostCreated(postId, msg.sender, nadId, block.timestamp);
    }

    // ─── Posting ─────────────────────────────────────────────

    /// Post a plain text message with no media.
    function postMessage(string calldata text) external {
        _validatePost(text);
        _storePost(text, "", MEDIA_NONE);
    }

    /// Post a text message with an image or GIF attachment.
    /// mediaType must be MEDIA_IMAGE (1) or MEDIA_GIF (2).
    function postMessageWithMedia(
        string calldata text,
        string calldata mediaURI,
        uint8 mediaType
    ) external {
        _validatePost(text);
        require(mediaType == MEDIA_IMAGE || mediaType == MEDIA_GIF, "Invalid media type");
        require(bytes(mediaURI).length > 0,                "mediaURI required for media post");
        require(bytes(mediaURI).length <= maxMediaURILength, "mediaURI too long");
        _storePost(text, mediaURI, mediaType);
    }

    // ─── Admin ───────────────────────────────────────────────

    function hidePost(uint256 postId, bool hidden) external onlyOwner {
        require(postId < posts.length, "Post does not exist");
        posts[postId].hidden = hidden;
        emit PostHidden(postId, hidden);
    }

    function setCooldown(uint256 newCooldown) external onlyOwner {
        require(newCooldown >= 30,    "Cooldown too short (min 30s)");
        require(newCooldown <= 600,   "Cooldown too long (max 10m)");
        emit CooldownUpdated(cooldown, newCooldown);
        cooldown = newCooldown;
    }

    function setMaxTextLength(uint256 newMax) external onlyOwner {
        require(newMax >= 10,  "Max text too short (min 10)");
        require(newMax <= 500, "Max text too long (max 500)");
        emit MaxTextLengthUpdated(maxTextLength, newMax);
        maxTextLength = newMax;
    }

    function setMaxMediaURILength(uint256 newMax) external onlyOwner {
        require(newMax <= 1000, "Max media URI too long (max 1000)");
        emit MaxMediaURILengthUpdated(maxMediaURILength, newMax);
        maxMediaURILength = newMax;
    }

    // ─── Read functions ──────────────────────────────────────

    function getPostCount() external view returns (uint256) {
        return posts.length;
    }

    function getNadCount() external view returns (uint256) {
        return nextNadId - 1;
    }

    function getCooldownRemaining(address user) external view returns (uint256) {
        uint256 elapsed = block.timestamp - lastPostTime[user];
        if (elapsed >= cooldown) return 0;
        return cooldown - elapsed;
    }

    /// Returns the latest posts, newest-first.
    /// @return ids        Post IDs
    /// @return authors    Author addresses
    /// @return nadIds     Nad IDs of authors
    /// @return texts      Post texts
    /// @return mediaURIs  Media URIs (empty string if none)
    /// @return mediaTypes Media types (0=none, 1=image, 2=gif)
    /// @return timestamps Unix timestamps
    /// @return hiddenFlags Whether each post is hidden
    function getLatestPosts(uint256 limit)
        external
        view
        returns (
            uint256[] memory ids,
            address[] memory authors,
            uint256[] memory nadIds,
            string[]  memory texts,
            string[]  memory mediaURIs,
            uint8[]   memory mediaTypes,
            uint256[] memory timestamps,
            bool[]    memory hiddenFlags
        )
    {
        uint256 total = posts.length;
        if (limit > MAX_READ) limit = MAX_READ;
        uint256 count = limit < total ? limit : total;

        ids        = new uint256[](count);
        authors    = new address[](count);
        nadIds     = new uint256[](count);
        texts      = new string[](count);
        mediaURIs  = new string[](count);
        mediaTypes = new uint8[](count);
        timestamps = new uint256[](count);
        hiddenFlags = new bool[](count);

        // newest-first: start from the last post
        for (uint256 i = 0; i < count; i++) {
            uint256 postId = total - 1 - i;
            Post storage p = posts[postId];
            ids[i]         = postId;
            authors[i]     = p.author;
            nadIds[i]      = p.nadId;
            texts[i]       = p.text;
            mediaURIs[i]   = p.mediaURI;
            mediaTypes[i]  = p.mediaType;
            timestamps[i]  = p.timestamp;
            hiddenFlags[i] = p.hidden;
        }
    }

    /// Cursor-based pagination. Returns posts older than beforeId, newest-first.
    /// beforeId is exclusive. Pass getPostCount() to start from the newest post.
    /// @return ids        Post IDs
    /// @return authors    Author addresses
    /// @return nadIds     Nad IDs of authors
    /// @return texts      Post texts
    /// @return mediaURIs  Media URIs (empty string if none)
    /// @return mediaTypes Media types (0=none, 1=image, 2=gif)
    /// @return timestamps Unix timestamps
    /// @return hiddenFlags Whether each post is hidden
    function getPostsBefore(uint256 beforeId, uint256 limit)
        external
        view
        returns (
            uint256[] memory ids,
            address[] memory authors,
            uint256[] memory nadIds,
            string[]  memory texts,
            string[]  memory mediaURIs,
            uint8[]   memory mediaTypes,
            uint256[] memory timestamps,
            bool[]    memory hiddenFlags
        )
    {
        uint256 total = posts.length;
        if (beforeId > total) beforeId = total;
        if (limit > MAX_READ) limit = MAX_READ;

        // how many posts are older than beforeId
        uint256 available = beforeId;
        uint256 count = limit < available ? limit : available;

        ids        = new uint256[](count);
        authors    = new address[](count);
        nadIds     = new uint256[](count);
        texts      = new string[](count);
        mediaURIs  = new string[](count);
        mediaTypes = new uint8[](count);
        timestamps = new uint256[](count);
        hiddenFlags = new bool[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 postId = beforeId - 1 - i;
            Post storage p = posts[postId];
            ids[i]         = postId;
            authors[i]     = p.author;
            nadIds[i]      = p.nadId;
            texts[i]       = p.text;
            mediaURIs[i]   = p.mediaURI;
            mediaTypes[i]  = p.mediaType;
            timestamps[i]  = p.timestamp;
            hiddenFlags[i] = p.hidden;
        }
    }

    /// Returns the latest posts by a specific wallet, newest-first.
    /// Uses the per-wallet index — does not scan all posts.
    /// @return ids        Post IDs
    /// @return authors    Author addresses
    /// @return nadIds     Nad IDs of authors
    /// @return texts      Post texts
    /// @return mediaURIs  Media URIs (empty string if none)
    /// @return mediaTypes Media types (0=none, 1=image, 2=gif)
    /// @return timestamps Unix timestamps
    /// @return hiddenFlags Whether each post is hidden
    function getPostsByWallet(address user, uint256 limit)
        external
        view
        returns (
            uint256[] memory ids,
            address[] memory authors,
            uint256[] memory nadIds,
            string[]  memory texts,
            string[]  memory mediaURIs,
            uint8[]   memory mediaTypes,
            uint256[] memory timestamps,
            bool[]    memory hiddenFlags
        )
    {
        uint256[] storage wallet = postsByWallet[user];
        uint256 total = wallet.length;
        if (limit > MAX_READ) limit = MAX_READ;
        uint256 count = limit < total ? limit : total;

        ids        = new uint256[](count);
        authors    = new address[](count);
        nadIds     = new uint256[](count);
        texts      = new string[](count);
        mediaURIs  = new string[](count);
        mediaTypes = new uint8[](count);
        timestamps = new uint256[](count);
        hiddenFlags = new bool[](count);

        // newest-first: walk wallet index from the end
        for (uint256 i = 0; i < count; i++) {
            uint256 postId = wallet[total - 1 - i];
            Post storage p = posts[postId];
            ids[i]         = postId;
            authors[i]     = p.author;
            nadIds[i]      = p.nadId;
            texts[i]       = p.text;
            mediaURIs[i]   = p.mediaURI;
            mediaTypes[i]  = p.mediaType;
            timestamps[i]  = p.timestamp;
            hiddenFlags[i] = p.hidden;
        }
    }
}
