/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: { loggedIn: true; uid: string } | null;
  }
}
