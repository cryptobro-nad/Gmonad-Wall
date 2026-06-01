import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { GmonadWallCore } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const COOLDOWN  = 60;   // seconds (default)
const MAX_TEXT  = 120;
const MAX_MEDIA = 300;
const MAX_READ  = 50;

describe("GmonadWallCore", () => {
  let wall: GmonadWallCore;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("GmonadWallCore");
    wall = (await Factory.deploy()) as GmonadWallCore;
    await wall.waitForDeployment();
  });

  // ─── 1. Deployment / defaults ─────────────────────────────────────────────

  describe("deployment / defaults", () => {
    it("deployer is the owner", async () => {
      expect(await wall.owner()).to.equal(owner.address);
    });
    it("starts unpaused", async () => {
      expect(await wall.paused()).to.equal(false);
    });
    it("cooldown defaults to 60 seconds", async () => {
      expect(await wall.cooldown()).to.equal(60);
    });
    it("maxTextLength defaults to 120", async () => {
      expect(await wall.maxTextLength()).to.equal(120);
    });
    it("maxMediaURILength defaults to 300", async () => {
      expect(await wall.maxMediaURILength()).to.equal(300);
    });
    it("MAX_READ is 50", async () => {
      expect(await wall.MAX_READ()).to.equal(50);
    });
    it("nextNadId starts at 1", async () => {
      expect(await wall.nextNadId()).to.equal(1);
    });
    it("getNadCount returns 0 before any posts", async () => {
      expect(await wall.getNadCount()).to.equal(0);
    });
    it("getPostCount returns 0 before any posts", async () => {
      expect(await wall.getPostCount()).to.equal(0);
    });
  });

  // ─── 2. Pause / unpause ───────────────────────────────────────────────────

  describe("pause / unpause", () => {
    it("owner can pause", async () => {
      await wall.pause();
      expect(await wall.paused()).to.equal(true);
    });
    it("owner can unpause after pausing", async () => {
      await wall.pause();
      await wall.unpause();
      expect(await wall.paused()).to.equal(false);
    });
    it("non-owner cannot pause", async () => {
      await expect(
        wall.connect(alice).pause()
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
    it("non-owner cannot unpause", async () => {
      await wall.pause();
      await expect(
        wall.connect(alice).unpause()
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
    it("pause() reverts when already paused", async () => {
      await wall.pause();
      await expect(wall.pause()).to.be.revertedWithCustomError(wall, "EnforcedPause");
    });
    it("unpause() reverts when not paused", async () => {
      await expect(wall.unpause()).to.be.revertedWithCustomError(wall, "ExpectedPause");
    });
    it("emits Paused event with owner address", async () => {
      await expect(wall.pause())
        .to.emit(wall, "Paused")
        .withArgs(owner.address);
    });
    it("emits Unpaused event with owner address", async () => {
      await wall.pause();
      await expect(wall.unpause())
        .to.emit(wall, "Unpaused")
        .withArgs(owner.address);
    });
  });

  // ─── 3. postMessage — pause enforcement ───────────────────────────────────

  describe("postMessage — pause enforcement", () => {
    it("succeeds when unpaused", async () => {
      await expect(wall.connect(alice).postMessage("gm")).to.not.be.reverted;
    });
    it("reverts when paused", async () => {
      await wall.pause();
      await expect(
        wall.connect(alice).postMessage("gm")
      ).to.be.revertedWithCustomError(wall, "EnforcedPause");
    });
    it("succeeds again after unpause", async () => {
      await wall.pause();
      await wall.unpause();
      await expect(wall.connect(alice).postMessage("gm")).to.not.be.reverted;
    });
  });

  // ─── 4. postMessageWithMedia — pause enforcement ──────────────────────────

  describe("postMessageWithMedia — pause enforcement", () => {
    it("succeeds when unpaused", async () => {
      await expect(
        wall.connect(alice).postMessageWithMedia("gm", "https://img.example.com", 1)
      ).to.not.be.reverted;
    });
    it("reverts when paused", async () => {
      await wall.pause();
      await expect(
        wall.connect(alice).postMessageWithMedia("gm", "https://img.example.com", 1)
      ).to.be.revertedWithCustomError(wall, "EnforcedPause");
    });
    it("succeeds again after unpause", async () => {
      await wall.pause();
      await wall.unpause();
      await expect(
        wall.connect(alice).postMessageWithMedia("gm", "https://img.example.com", 1)
      ).to.not.be.reverted;
    });
  });

  // ─── 5. Read functions available while paused ─────────────────────────────

  describe("read functions available while paused", () => {
    beforeEach(async () => {
      await wall.connect(alice).postMessage("before pause");
      await wall.pause();
    });

    it("getLatestPosts works while paused", async () => {
      const [ids] = await wall.getLatestPosts(10);
      expect(ids.length).to.equal(1);
    });
    it("getPostsBefore works while paused", async () => {
      const total = await wall.getPostCount();
      const [ids] = await wall.getPostsBefore(total, 10);
      expect(ids.length).to.equal(1);
    });
    it("getPostsByWallet works while paused", async () => {
      const [ids] = await wall.getPostsByWallet(alice.address, 10);
      expect(ids.length).to.equal(1);
    });
    it("getPostCount works while paused", async () => {
      expect(await wall.getPostCount()).to.equal(1);
    });
    it("getNadCount works while paused", async () => {
      expect(await wall.getNadCount()).to.equal(1);
    });
    it("getCooldownRemaining works while paused", async () => {
      const remaining = await wall.getCooldownRemaining(alice.address);
      expect(remaining).to.be.gte(0);
    });
  });

  // ─── 6. hidePost available while paused ───────────────────────────────────

  describe("hidePost available while paused", () => {
    beforeEach(async () => {
      await wall.connect(alice).postMessage("a post");
      await wall.pause();
    });

    it("owner can hide a post while paused", async () => {
      await expect(wall.hidePost(0, true)).to.not.be.reverted;
      const [, , , , , , , hiddenFlags] = await wall.getLatestPosts(1);
      expect(hiddenFlags[0]).to.equal(true);
    });
    it("owner can unhide a post while paused", async () => {
      await wall.hidePost(0, true);
      await expect(wall.hidePost(0, false)).to.not.be.reverted;
      const [, , , , , , , hiddenFlags] = await wall.getLatestPosts(1);
      expect(hiddenFlags[0]).to.equal(false);
    });
    it("non-owner cannot hide while paused", async () => {
      await expect(
        wall.connect(alice).hidePost(0, true)
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
  });

  // ─── 7. Nad identity ──────────────────────────────────────────────────────

  describe("Nad identity", () => {
    it("first wallet gets Nad #1", async () => {
      await wall.connect(alice).postMessage("gm");
      expect(await wall.nadIdOf(alice.address)).to.equal(1);
    });
    it("second wallet gets Nad #2", async () => {
      await wall.connect(alice).postMessage("gm");
      await wall.connect(bob).postMessage("gm");
      expect(await wall.nadIdOf(bob.address)).to.equal(2);
    });
    it("same wallet keeps the same Nad ID after multiple posts", async () => {
      await wall.connect(alice).postMessage("first");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("second");
      expect(await wall.nadIdOf(alice.address)).to.equal(1);
    });
    it("getNadCount increments once per new wallet", async () => {
      expect(await wall.getNadCount()).to.equal(0);
      await wall.connect(alice).postMessage("gm");
      expect(await wall.getNadCount()).to.equal(1);
      await wall.connect(bob).postMessage("gm");
      expect(await wall.getNadCount()).to.equal(2);
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("again");
      expect(await wall.getNadCount()).to.equal(2);
    });
    it("ownerOfNad maps Nad ID back to the correct address", async () => {
      await wall.connect(alice).postMessage("gm");
      await wall.connect(bob).postMessage("gm");
      expect(await wall.ownerOfNad(1)).to.equal(alice.address);
      expect(await wall.ownerOfNad(2)).to.equal(bob.address);
    });
    it("NadAssigned emits on first post from a wallet", async () => {
      const tx = await wall.connect(alice).postMessage("first");
      await expect(tx).to.emit(wall, "NadAssigned").withArgs(alice.address, 1);
    });
    it("NadAssigned does not emit on subsequent posts from the same wallet", async () => {
      await wall.connect(alice).postMessage("first");
      await time.increase(COOLDOWN);
      const tx2 = await wall.connect(alice).postMessage("second");
      await expect(tx2).to.not.emit(wall, "NadAssigned");
    });
    it("wallet with no posts has nadIdOf 0", async () => {
      expect(await wall.nadIdOf(carol.address)).to.equal(0);
    });
  });

  // ─── 8. postMessage (text) ────────────────────────────────────────────────

  describe("postMessage (text only)", () => {
    it("stores all fields correctly", async () => {
      const tx = await wall.connect(alice).postMessage("hello monad");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const [ids, authors, nadIds, texts, mediaURIs, mediaTypes, timestamps, hiddenFlags] =
        await wall.getLatestPosts(1);

      expect(ids[0]).to.equal(0);
      expect(authors[0]).to.equal(alice.address);
      expect(nadIds[0]).to.equal(1);
      expect(texts[0]).to.equal("hello monad");
      expect(mediaURIs[0]).to.equal("");
      expect(mediaTypes[0]).to.equal(0);
      expect(timestamps[0]).to.equal(block!.timestamp);
      expect(hiddenFlags[0]).to.equal(false);
    });
    it("increments post count with each post", async () => {
      await wall.connect(alice).postMessage("one");
      expect(await wall.getPostCount()).to.equal(1);
      await wall.connect(bob).postMessage("two");
      expect(await wall.getPostCount()).to.equal(2);
    });
    it("emits PostCreated with correct postId, author, nadId, timestamp", async () => {
      const tx = await wall.connect(alice).postMessage("gm");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      await expect(tx)
        .to.emit(wall, "PostCreated")
        .withArgs(0, alice.address, 1, block!.timestamp);
    });
    it("reverts on empty text", async () => {
      await expect(wall.connect(alice).postMessage("")).to.be.revertedWith("Text required");
    });
    it("reverts when text exceeds maxTextLength", async () => {
      await expect(
        wall.connect(alice).postMessage("a".repeat(MAX_TEXT + 1))
      ).to.be.revertedWith("Text too long");
    });
    it("accepts text of exactly maxTextLength bytes", async () => {
      await expect(wall.connect(alice).postMessage("a".repeat(MAX_TEXT))).to.not.be.reverted;
    });
  });

  // ─── 9. postMessageWithMedia ──────────────────────────────────────────────

  describe("postMessageWithMedia", () => {
    it("stores a mediaType=1 (image) post correctly", async () => {
      await wall.connect(alice).postMessageWithMedia("look", "https://img.example.com/cat.jpg", 1);
      const [, , , texts, mediaURIs, mediaTypes] = await wall.getLatestPosts(1);
      expect(texts[0]).to.equal("look");
      expect(mediaURIs[0]).to.equal("https://img.example.com/cat.jpg");
      expect(mediaTypes[0]).to.equal(1);
    });
    it("stores a mediaType=2 (gif) post correctly", async () => {
      await wall.connect(alice).postMessageWithMedia("woah", "https://giphy.com/abc.gif", 2);
      const [, , , , mediaURIs, mediaTypes] = await wall.getLatestPosts(1);
      expect(mediaURIs[0]).to.equal("https://giphy.com/abc.gif");
      expect(mediaTypes[0]).to.equal(2);
    });
    it("emits PostCreated for media posts", async () => {
      const tx = await wall.connect(alice).postMessageWithMedia("gm", "https://img.example.com", 1);
      await expect(tx).to.emit(wall, "PostCreated").withArgs(0, alice.address, 1, anyValue);
    });
    it("reverts when mediaType=0", async () => {
      await expect(
        wall.connect(alice).postMessageWithMedia("text", "https://example.com", 0)
      ).to.be.revertedWith("Invalid media type");
    });
    it("reverts when mediaType=1 and mediaURI is empty", async () => {
      await expect(
        wall.connect(alice).postMessageWithMedia("text", "", 1)
      ).to.be.revertedWith("mediaURI required for media post");
    });
    it("reverts when mediaType=2 and mediaURI is empty", async () => {
      await expect(
        wall.connect(alice).postMessageWithMedia("text", "", 2)
      ).to.be.revertedWith("mediaURI required for media post");
    });
    it("reverts when mediaType is above 2", async () => {
      await expect(
        wall.connect(alice).postMessageWithMedia("text", "https://example.com", 3)
      ).to.be.revertedWith("Invalid media type");
    });
    it("reverts when mediaURI exceeds maxMediaURILength", async () => {
      await expect(
        wall.connect(alice).postMessageWithMedia("text", "a".repeat(MAX_MEDIA + 1), 1)
      ).to.be.revertedWith("mediaURI too long");
    });
    it("accepts mediaURI of exactly maxMediaURILength bytes", async () => {
      await expect(
        wall.connect(alice).postMessageWithMedia("text", "a".repeat(MAX_MEDIA), 1)
      ).to.not.be.reverted;
    });
  });

  // ─── 10. Cooldown ─────────────────────────────────────────────────────────

  describe("cooldown", () => {
    it("cannot post during cooldown", async () => {
      await wall.connect(alice).postMessage("first");
      await expect(wall.connect(alice).postMessage("second")).to.be.revertedWith("Cooldown active");
    });
    it("different wallet can post while another is in cooldown", async () => {
      await wall.connect(alice).postMessage("alice");
      await expect(wall.connect(bob).postMessage("bob")).to.not.be.reverted;
    });
    it("can post again after cooldown expires", async () => {
      await wall.connect(alice).postMessage("first");
      await time.increase(COOLDOWN);
      await expect(wall.connect(alice).postMessage("second")).to.not.be.reverted;
    });
    it("cooldown resets after each successful post", async () => {
      await wall.connect(alice).postMessage("first");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("second");
      await expect(wall.connect(alice).postMessage("third")).to.be.revertedWith("Cooldown active");
    });
    it("getCooldownRemaining returns 0 for user who never posted", async () => {
      expect(await wall.getCooldownRemaining(alice.address)).to.equal(0);
    });
    it("getCooldownRemaining returns a positive value immediately after posting", async () => {
      await wall.connect(alice).postMessage("gm");
      const remaining = await wall.getCooldownRemaining(alice.address);
      expect(remaining).to.be.gt(0);
      expect(remaining).to.be.lte(COOLDOWN);
    });
    it("getCooldownRemaining returns 0 once cooldown elapses", async () => {
      await wall.connect(alice).postMessage("gm");
      await time.increase(COOLDOWN);
      expect(await wall.getCooldownRemaining(alice.address)).to.equal(0);
    });
    it("owner can update cooldown", async () => {
      await wall.setCooldown(120);
      expect(await wall.cooldown()).to.equal(120);
    });
    it("non-owner cannot update cooldown", async () => {
      await expect(
        wall.connect(alice).setCooldown(120)
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
    it("setCooldown reverts below 30 seconds", async () => {
      await expect(wall.setCooldown(29)).to.be.revertedWith("Cooldown too short (min 30s)");
    });
    it("setCooldown allows exactly 30 seconds", async () => {
      await expect(wall.setCooldown(30)).to.not.be.reverted;
    });
    it("setCooldown reverts above 600 seconds", async () => {
      await expect(wall.setCooldown(601)).to.be.revertedWith("Cooldown too long (max 10m)");
    });
    it("setCooldown allows exactly 600 seconds", async () => {
      await expect(wall.setCooldown(600)).to.not.be.reverted;
    });
    it("emits CooldownUpdated with old and new values", async () => {
      await expect(wall.setCooldown(120))
        .to.emit(wall, "CooldownUpdated")
        .withArgs(60, 120);
    });
  });

  // ─── 11. setMaxTextLength ─────────────────────────────────────────────────

  describe("setMaxTextLength", () => {
    it("owner can update max text length", async () => {
      await wall.setMaxTextLength(200);
      expect(await wall.maxTextLength()).to.equal(200);
    });
    it("non-owner cannot update max text length", async () => {
      await expect(
        wall.connect(alice).setMaxTextLength(200)
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
    it("reverts below minimum of 10", async () => {
      await expect(wall.setMaxTextLength(9)).to.be.revertedWith("Max text too short (min 10)");
    });
    it("allows exactly 10", async () => {
      await expect(wall.setMaxTextLength(10)).to.not.be.reverted;
    });
    it("reverts above maximum of 500", async () => {
      await expect(wall.setMaxTextLength(501)).to.be.revertedWith("Max text too long (max 500)");
    });
    it("allows exactly 500", async () => {
      await expect(wall.setMaxTextLength(500)).to.not.be.reverted;
    });
    it("emits MaxTextLengthUpdated with old and new values", async () => {
      await expect(wall.setMaxTextLength(200))
        .to.emit(wall, "MaxTextLengthUpdated")
        .withArgs(120, 200);
    });
    it("new max immediately affects posting", async () => {
      await wall.setMaxTextLength(10);
      await expect(
        wall.connect(alice).postMessage("a".repeat(11))
      ).to.be.revertedWith("Text too long");
      await expect(
        wall.connect(alice).postMessage("a".repeat(10))
      ).to.not.be.reverted;
    });
  });

  // ─── 12. setMaxMediaURILength ─────────────────────────────────────────────

  describe("setMaxMediaURILength", () => {
    it("owner can update max media URI length", async () => {
      await wall.setMaxMediaURILength(500);
      expect(await wall.maxMediaURILength()).to.equal(500);
    });
    it("non-owner cannot update", async () => {
      await expect(
        wall.connect(alice).setMaxMediaURILength(500)
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
    it("reverts above 1000", async () => {
      await expect(wall.setMaxMediaURILength(1001)).to.be.revertedWith(
        "Max media URI too long (max 1000)"
      );
    });
    it("allows exactly 1000", async () => {
      await expect(wall.setMaxMediaURILength(1000)).to.not.be.reverted;
    });
    it("allows 0 (disables all media URIs)", async () => {
      await expect(wall.setMaxMediaURILength(0)).to.not.be.reverted;
      expect(await wall.maxMediaURILength()).to.equal(0);
    });
    it("emits MaxMediaURILengthUpdated with old and new values", async () => {
      await expect(wall.setMaxMediaURILength(500))
        .to.emit(wall, "MaxMediaURILengthUpdated")
        .withArgs(300, 500);
    });
    it("maxMediaURILength=0 causes any non-empty mediaURI to revert", async () => {
      await wall.setMaxMediaURILength(0);
      await expect(
        wall.connect(alice).postMessageWithMedia("text", "a", 1)
      ).to.be.revertedWith("mediaURI too long");
    });
  });

  // ─── 13. getLatestPosts ───────────────────────────────────────────────────

  describe("getLatestPosts", () => {
    it("returns empty arrays when no posts exist", async () => {
      const [ids, authors, nadIds, texts, mediaURIs, mediaTypes, timestamps, hiddenFlags] =
        await wall.getLatestPosts(10);
      expect(ids.length).to.equal(0);
      expect(authors.length).to.equal(0);
      expect(nadIds.length).to.equal(0);
      expect(texts.length).to.equal(0);
      expect(mediaURIs.length).to.equal(0);
      expect(mediaTypes.length).to.equal(0);
      expect(timestamps.length).to.equal(0);
      expect(hiddenFlags.length).to.equal(0);
    });
    it("returns fewer results than limit when not enough posts exist", async () => {
      await wall.connect(alice).postMessage("only one");
      const [ids] = await wall.getLatestPosts(10);
      expect(ids.length).to.equal(1);
    });
    it("returns posts newest-first", async () => {
      await wall.connect(alice).postMessage("first");
      await wall.connect(bob).postMessage("second");
      await wall.connect(carol).postMessage("third");

      const [ids, , , texts] = await wall.getLatestPosts(3);
      expect(ids[0]).to.equal(2);
      expect(ids[1]).to.equal(1);
      expect(ids[2]).to.equal(0);
      expect(texts[0]).to.equal("third");
      expect(texts[2]).to.equal("first");
    });
    it("respects limit", async () => {
      await wall.connect(alice).postMessage("one");
      await wall.connect(bob).postMessage("two");
      await wall.connect(carol).postMessage("three");

      const [ids] = await wall.getLatestPosts(2);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(2);
      expect(ids[1]).to.equal(1);
    });
    it("caps at MAX_READ even when limit is larger", async () => {
      const signers = await ethers.getSigners();
      for (let i = 0; i < MAX_READ + 5; i++) {
        const s = signers[i % signers.length];
        if (i >= signers.length) await time.increase(COOLDOWN);
        await wall.connect(s).postMessage(`msg ${i}`);
      }
      const [ids] = await wall.getLatestPosts(MAX_READ + 10);
      expect(ids.length).to.equal(MAX_READ);
    });
    it("reflects hidden flag correctly", async () => {
      await wall.connect(alice).postMessage("post");
      await wall.hidePost(0, true);
      const [, , , , , , , hiddenFlags] = await wall.getLatestPosts(1);
      expect(hiddenFlags[0]).to.equal(true);
    });
  });

  // ─── 14. getPostsBefore — cursor pagination ───────────────────────────────

  describe("getPostsBefore", () => {
    beforeEach(async () => {
      const signers = await ethers.getSigners();
      for (let i = 0; i < 5; i++) {
        await wall.connect(signers[i]).postMessage(`msg ${i}`);
      }
    });

    it("beforeId is exclusive — getPostsBefore(2) returns ids [1, 0]", async () => {
      const [ids] = await wall.getPostsBefore(2, 10);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(0);
    });
    it("returns posts newest-first", async () => {
      const [ids, , , texts] = await wall.getPostsBefore(5, 3);
      expect(ids[0]).to.equal(4);
      expect(ids[1]).to.equal(3);
      expect(ids[2]).to.equal(2);
      expect(texts[0]).to.equal("msg 4");
    });
    it("respects limit", async () => {
      const [ids] = await wall.getPostsBefore(5, 2);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(4);
      expect(ids[1]).to.equal(3);
    });
    it("clamps beforeId to post count when beforeId exceeds it", async () => {
      const [ids] = await wall.getPostsBefore(999, 5);
      expect(ids.length).to.equal(5);
      expect(ids[0]).to.equal(4);
    });
    it("returns empty array when beforeId is 0", async () => {
      const [ids] = await wall.getPostsBefore(0, 10);
      expect(ids.length).to.equal(0);
    });
    it("produces no duplicate post IDs across two consecutive pages", async () => {
      const total = await wall.getPostCount();
      const [page1] = await wall.getPostsBefore(total, 3); // [4, 3, 2]
      const cursor = page1[page1.length - 1];
      const [page2] = await wall.getPostsBefore(cursor, 3); // [1, 0]

      const seen = new Set(page1.map((id) => id.toString()));
      for (const id of page2) {
        expect(seen.has(id.toString())).to.equal(false);
      }
    });
    it("two pages together cover all posts with no gaps", async () => {
      const total = await wall.getPostCount();
      const [page1] = await wall.getPostsBefore(total, 3);
      const cursor = page1[page1.length - 1];
      const [page2] = await wall.getPostsBefore(cursor, 3);

      const allIds = [...page1, ...page2].map((id) => Number(id)).sort((a, b) => a - b);
      expect(allIds).to.deep.equal([0, 1, 2, 3, 4]);
    });
    it("caps at MAX_READ", async () => {
      const signers = await ethers.getSigners();
      for (let i = 5; i < MAX_READ + 5; i++) {
        await time.increase(COOLDOWN);
        await wall.connect(signers[i % signers.length]).postMessage(`extra ${i}`);
      }
      const total = await wall.getPostCount();
      const [ids] = await wall.getPostsBefore(total, MAX_READ + 10);
      expect(ids.length).to.equal(MAX_READ);
    });
  });

  // ─── 15. getPostsByWallet ─────────────────────────────────────────────────

  describe("getPostsByWallet", () => {
    it("returns empty array for wallet with no posts", async () => {
      const [ids] = await wall.getPostsByWallet(carol.address, 10);
      expect(ids.length).to.equal(0);
    });
    it("returns only posts from the specified wallet", async () => {
      await wall.connect(alice).postMessage("alice 1");
      await wall.connect(bob).postMessage("bob 1");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("alice 2");

      const [ids] = await wall.getPostsByWallet(alice.address, 10);
      const idNums = ids.map((id) => Number(id));
      expect(idNums).to.have.members([0, 2]);
      expect(idNums).to.not.include(1);
    });
    it("returns posts newest-first", async () => {
      await wall.connect(alice).postMessage("first");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("second");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("third");

      const [ids, , , texts] = await wall.getPostsByWallet(alice.address, 10);
      expect(ids[0]).to.equal(2);
      expect(ids[2]).to.equal(0);
      expect(texts[0]).to.equal("third");
    });
    it("respects limit", async () => {
      await wall.connect(alice).postMessage("one");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("two");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("three");

      const [ids] = await wall.getPostsByWallet(alice.address, 2);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(2);
    });
    it("caps at MAX_READ", async () => {
      for (let i = 0; i < MAX_READ + 5; i++) {
        await wall.connect(alice).postMessage(`post ${i}`);
        await time.increase(COOLDOWN);
      }
      const [ids] = await wall.getPostsByWallet(alice.address, MAX_READ + 10);
      expect(ids.length).to.equal(MAX_READ);
    });
    it("does not scan posts from other wallets", async () => {
      await wall.connect(alice).postMessage("a1");
      await wall.connect(bob).postMessage("b1");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("a2");
      await wall.connect(bob).postMessage("b2");

      const [aliceIds] = await wall.getPostsByWallet(alice.address, 10);
      const [bobIds]   = await wall.getPostsByWallet(bob.address, 10);
      expect(aliceIds.map(Number)).to.have.members([0, 2]);
      expect(bobIds.map(Number)).to.have.members([1, 3]);
    });
  });

  // ─── 16. Moderation (hidePost) ────────────────────────────────────────────

  describe("hidePost", () => {
    beforeEach(async () => {
      await wall.connect(alice).postMessage("visible post");
    });

    it("owner can hide a post", async () => {
      await wall.hidePost(0, true);
      const [, , , , , , , hiddenFlags] = await wall.getLatestPosts(1);
      expect(hiddenFlags[0]).to.equal(true);
    });
    it("owner can unhide a previously hidden post", async () => {
      await wall.hidePost(0, true);
      await wall.hidePost(0, false);
      const [, , , , , , , hiddenFlags] = await wall.getLatestPosts(1);
      expect(hiddenFlags[0]).to.equal(false);
    });
    it("non-owner cannot hide a post", async () => {
      await expect(
        wall.connect(alice).hidePost(0, true)
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
    it("reverts for a non-existent post id", async () => {
      await expect(wall.hidePost(999, true)).to.be.revertedWith("Post does not exist");
    });
    it("emits PostHidden when hiding", async () => {
      await expect(wall.hidePost(0, true))
        .to.emit(wall, "PostHidden")
        .withArgs(0, true);
    });
    it("emits PostHidden when unhiding", async () => {
      await wall.hidePost(0, true);
      await expect(wall.hidePost(0, false))
        .to.emit(wall, "PostHidden")
        .withArgs(0, false);
    });
    it("hidden flag is visible in getPostsBefore", async () => {
      await wall.hidePost(0, true);
      const total = await wall.getPostCount();
      const [, , , , , , , hiddenFlags] = await wall.getPostsBefore(total, 1);
      expect(hiddenFlags[0]).to.equal(true);
    });
    it("hidden flag is visible in getPostsByWallet", async () => {
      await wall.hidePost(0, true);
      const [, , , , , , , hiddenFlags] = await wall.getPostsByWallet(alice.address, 1);
      expect(hiddenFlags[0]).to.equal(true);
    });
  });
});
