import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { GmonadWall } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const COOLDOWN = 5 * 60; // 5 minutes in seconds
const MAX_LENGTH = 120;
const MAX_READ = 50;

describe("GmonadWall", () => {
  let wall: GmonadWall;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("GmonadWall");
    wall = (await Factory.deploy()) as GmonadWall;
    await wall.waitForDeployment();
  });

  // ─── Constants ─────────────────────────────────────────────────────────────

  describe("constants", () => {
    it("MAX_READ is 50", async () => {
      expect(await wall.MAX_READ()).to.equal(50);
    });

    it("COOLDOWN is 5 minutes", async () => {
      expect(await wall.COOLDOWN()).to.equal(COOLDOWN);
    });

    it("MAX_LENGTH is 120", async () => {
      expect(await wall.MAX_LENGTH()).to.equal(MAX_LENGTH);
    });
  });

  // ─── Ownership ─────────────────────────────────────────────────────────────

  describe("ownership", () => {
    it("deployer is the owner", async () => {
      expect(await wall.owner()).to.equal(owner.address);
    });
  });

  // ─── postMessage ───────────────────────────────────────────────────────────

  describe("postMessage", () => {
    it("posts a valid message and increments count", async () => {
      await wall.connect(alice).postMessage("gm!");
      expect(await wall.getMessageCount()).to.equal(1);
    });

    it("emits MessagePosted with correct id, author, and timestamp", async () => {
      const tx = await wall.connect(alice).postMessage("gm!");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(wall, "MessagePosted")
        .withArgs(0, alice.address, block!.timestamp);
    });

    it("stores message text, author, and hidden=false correctly", async () => {
      await wall.connect(alice).postMessage("hello monad");

      const [ids, texts, , hiddenFlags] = await wall.getLatestMessages(1);
      expect(ids[0]).to.equal(0);
      expect(texts[0]).to.equal("hello monad");
      expect(hiddenFlags[0]).to.equal(false);
    });

    it("reverts on empty message", async () => {
      await expect(wall.connect(alice).postMessage("")).to.be.revertedWith(
        "Empty message"
      );
    });

    it("reverts when message exceeds MAX_LENGTH (120 chars)", async () => {
      const tooLong = "a".repeat(MAX_LENGTH + 1);
      await expect(
        wall.connect(alice).postMessage(tooLong)
      ).to.be.revertedWith("Message too long");
    });

    it("accepts a message of exactly MAX_LENGTH characters", async () => {
      const exact = "a".repeat(MAX_LENGTH);
      await expect(wall.connect(alice).postMessage(exact)).to.not.be.reverted;
    });

    it("reverts when cooldown is still active", async () => {
      await wall.connect(alice).postMessage("first");
      await expect(wall.connect(alice).postMessage("second")).to.be.revertedWith(
        "Cooldown active"
      );
    });

    it("allows a second post after cooldown expires", async () => {
      await wall.connect(alice).postMessage("first");
      await time.increase(COOLDOWN);
      await expect(wall.connect(alice).postMessage("second")).to.not.be.reverted;
      expect(await wall.getMessageCount()).to.equal(2);
    });

    it("cooldown is per-user — different users can post independently", async () => {
      await wall.connect(alice).postMessage("alice's post");
      await expect(wall.connect(bob).postMessage("bob's post")).to.not.be.reverted;
    });

    it("updates lastPosted after each successful post", async () => {
      await wall.connect(alice).postMessage("first");
      await time.increase(COOLDOWN);
      await wall.connect(alice).postMessage("second");

      // Should be in cooldown again after the second post
      await expect(wall.connect(alice).postMessage("third")).to.be.revertedWith(
        "Cooldown active"
      );
    });
  });

  // ─── getMessageCount ───────────────────────────────────────────────────────

  describe("getMessageCount", () => {
    it("returns 0 before any messages", async () => {
      expect(await wall.getMessageCount()).to.equal(0);
    });

    it("increments correctly with each post", async () => {
      await wall.connect(alice).postMessage("one");
      await wall.connect(bob).postMessage("two");
      expect(await wall.getMessageCount()).to.equal(2);
    });
  });

  // ─── getLatestMessages ─────────────────────────────────────────────────────

  describe("getLatestMessages", () => {
    it("returns empty arrays when there are no messages", async () => {
      const [ids, texts, timestamps, hiddenFlags] = await wall.getLatestMessages(10);
      expect(ids.length).to.equal(0);
      expect(texts.length).to.equal(0);
      expect(timestamps.length).to.equal(0);
      expect(hiddenFlags.length).to.equal(0);
    });

    it("returns all messages when limit >= total count", async () => {
      await wall.connect(alice).postMessage("msg 0");
      await wall.connect(bob).postMessage("msg 1");

      const [ids, texts] = await wall.getLatestMessages(10);
      expect(ids.length).to.equal(2);
      expect(texts[0]).to.equal("msg 0");
      expect(texts[1]).to.equal("msg 1");
    });

    it("returns only the latest N messages when limit < total", async () => {
      const signers = await ethers.getSigners();
      await wall.connect(signers[0]).postMessage("msg 0");
      await wall.connect(signers[1]).postMessage("msg 1");
      await wall.connect(signers[2]).postMessage("msg 2");

      const [ids, texts] = await wall.getLatestMessages(2);
      expect(ids.length).to.equal(2);
      expect(texts[0]).to.equal("msg 1");
      expect(texts[1]).to.equal("msg 2");
    });

    it("returns the most recent messages (highest ids) when limited", async () => {
      // Post 3 messages from different accounts to avoid cooldown
      const signers = await ethers.getSigners();
      for (let i = 0; i < 3; i++) {
        await wall.connect(signers[i]).postMessage(`msg ${i}`);
      }

      // Ask for only the latest 2
      const [ids, texts] = await wall.getLatestMessages(2);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1n);
      expect(ids[1]).to.equal(2n);
      expect(texts[0]).to.equal("msg 1");
      expect(texts[1]).to.equal("msg 2");
    });

    it("caps at MAX_READ (50) even when a larger limit is requested", async () => {
      const signers = await ethers.getSigners();
      // Post MAX_READ + 5 = 55 messages using 55 different signers (Hardhat gives 20 by default)
      // Use time.increase to reuse signers instead
      for (let i = 0; i < 20; i++) {
        await wall.connect(signers[i % signers.length]).postMessage(`msg ${i}`);
        if ((i + 1) % signers.length === 0) {
          await time.increase(COOLDOWN);
        }
      }
      // Hardhat gives 20 signers; post remaining with time jumps
      for (let i = 20; i < MAX_READ + 5; i++) {
        await time.increase(COOLDOWN);
        await wall.connect(signers[i % signers.length]).postMessage(`msg ${i}`);
      }

      const [ids] = await wall.getLatestMessages(MAX_READ + 10);
      expect(ids.length).to.equal(MAX_READ);
    });

    it("reflects hidden flag in returned data", async () => {
      await wall.connect(alice).postMessage("visible");
      await wall.hideMessage(0, true);

      const [, , , hiddenFlags] = await wall.getLatestMessages(1);
      expect(hiddenFlags[0]).to.equal(true);
    });

    it("returns correct timestamps for each message", async () => {
      const tx = await wall.connect(alice).postMessage("ts test");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const [, , timestamps] = await wall.getLatestMessages(1);
      expect(timestamps[0]).to.equal(block!.timestamp);
    });

    it("returns correct ids matching storage positions", async () => {
      const signers = await ethers.getSigners();
      for (let i = 0; i < 3; i++) {
        await wall.connect(signers[i]).postMessage(`msg ${i}`);
      }

      const [ids] = await wall.getLatestMessages(3);
      expect(ids[0]).to.equal(0n);
      expect(ids[1]).to.equal(1n);
      expect(ids[2]).to.equal(2n);
    });
  });

  // ─── getCooldownRemaining ──────────────────────────────────────────────────

  describe("getCooldownRemaining", () => {
    it("returns 0 for a user who has never posted", async () => {
      expect(await wall.getCooldownRemaining(alice.address)).to.equal(0);
    });

    it("returns a positive value immediately after posting", async () => {
      await wall.connect(alice).postMessage("gm");
      const remaining = await wall.getCooldownRemaining(alice.address);
      expect(remaining).to.be.gt(0);
      expect(remaining).to.be.lte(COOLDOWN);
    });

    it("returns 0 once the cooldown has fully elapsed", async () => {
      await wall.connect(alice).postMessage("gm");
      await time.increase(COOLDOWN);
      expect(await wall.getCooldownRemaining(alice.address)).to.equal(0);
    });

    it("decreases over time", async () => {
      await wall.connect(alice).postMessage("gm");
      const before = await wall.getCooldownRemaining(alice.address);
      await time.increase(60);
      const after = await wall.getCooldownRemaining(alice.address);
      expect(after).to.be.lt(before);
    });
  });

  // ─── hideMessage ───────────────────────────────────────────────────────────

  describe("hideMessage", () => {
    beforeEach(async () => {
      await wall.connect(alice).postMessage("will be hidden");
    });

    it("owner can hide a message", async () => {
      await wall.hideMessage(0, true);
      const [, , , hiddenFlags] = await wall.getLatestMessages(1);
      expect(hiddenFlags[0]).to.equal(true);
    });

    it("owner can unhide a previously hidden message", async () => {
      await wall.hideMessage(0, true);
      await wall.hideMessage(0, false);
      const [, , , hiddenFlags] = await wall.getLatestMessages(1);
      expect(hiddenFlags[0]).to.equal(false);
    });

    it("emits MessageHidden with correct id and hidden flag", async () => {
      await expect(wall.hideMessage(0, true))
        .to.emit(wall, "MessageHidden")
        .withArgs(0, true);
    });

    it("emits MessageHidden when unhiding", async () => {
      await wall.hideMessage(0, true);
      await expect(wall.hideMessage(0, false))
        .to.emit(wall, "MessageHidden")
        .withArgs(0, false);
    });

    it("reverts for a non-existent message id", async () => {
      await expect(wall.hideMessage(999, true)).to.be.revertedWith("Invalid id");
    });

    it("reverts when called by a non-owner", async () => {
      await expect(
        wall.connect(alice).hideMessage(0, true)
      ).to.be.revertedWithCustomError(wall, "OwnableUnauthorizedAccount");
    });
  });
});
