//! Local interface selection without external network traffic.

use std::net::Ipv4Addr;
use tokio::net::UdpSocket;

/// Returns the IPv4 address selected by the OS routing table.
pub async fn local_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").await.ok()?;
    // UDP connect only selects a route; it sends no packet.
    socket.connect("192.0.2.1:9").await.ok()?;
    match socket.local_addr().ok()?.ip() {
        std::net::IpAddr::V4(address) if !address.is_loopback() => Some(address),
        _ => None,
    }
}
